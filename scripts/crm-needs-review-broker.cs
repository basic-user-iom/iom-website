using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace IomJournal {
  public sealed class Session : IDisposable {
    const string WalName="state-wal.log";
    const int MaxState=631818, MaxWal=42944162;
    readonly string directory;
    readonly PinnedChain chain;
    readonly Dictionary<string,PinnedEvidence> files=new Dictionary<string,PinnedEvidence>(StringComparer.OrdinalIgnoreCase);
    PinnedEvidence operationLock, wal;
    byte[] baseline, latest;
    bool poisoned, closed;
    int records;
    long walBytes;
    readonly bool inspectOnly;
    readonly HashSet<string> names;
    static readonly Regex Evidence=new Regex(@"^(source-binding\.json|approval\.json|consents\.json|state\.json|hosted-dpl_[A-Za-z0-9]+\.json|operation\.lock|state-wal\.log)$",RegexOptions.CultureInvariant);
    static readonly UTF8Encoding Utf8=new UTF8Encoding(false,true);
    static readonly JavaScriptSerializer Json=new JavaScriptSerializer { MaxJsonLength=MaxState,RecursionLimit=64 };
    static string Hash(byte[] value) { using(var sha=SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(value)).Replace("-","").ToLowerInvariant(); }
    static void State(byte[] bytes) {
      if(bytes==null) return;
      if(bytes.Length>MaxState || !(Json.DeserializeObject(Utf8.GetString(bytes)) is Dictionary<string,object>)) throw new IOException("journal_state_invalid");
    }
    public Session(string path,bool inspect) {
      directory=Native.Canonical(path); inspectOnly=inspect;
      chain=new PinnedChain(directory);
      names=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
      try {
        foreach(string p in Directory.GetFileSystemEntries(directory)) {
          var name=Path.GetFileName(p);
          if(!Evidence.IsMatch(name) || !names.Add(name)) throw new IOException("journal_unexpected_or_incomplete_evidence");
        }
        if(!inspect && names.Contains("operation.lock")) throw new IOException("journal_locked_no_automatic_recovery");
        foreach(string name in names) {
          var file=new PinnedEvidence(Path.Combine(directory,name),false,name==WalName && !inspect);
          if(name==WalName) wal=file; else files.Add(name,file);
        }
        baseline=files.ContainsKey("state.json") ? files["state.json"].Read(MaxState) : null;
        State(baseline); latest=baseline;
        if(wal!=null) ParseWal(wal.Read(MaxWal));
        Verify();
        if(!inspect) {
          operationLock=new PinnedEvidence(Path.Combine(directory,"operation.lock"),true,true);
          names.Add("operation.lock");
          operationLock.Append(Utf8.GetBytes("iom-needs-review-held-session-v1\n"));
          Verify();
        }
      } catch { poisoned=true; Dispose(); throw; }
    }
    byte[] Header() { return Utf8.GetBytes("IOMNRWAL1 "+Hash(baseline ?? new byte[0])+"\n"); }
    void ParseWal(byte[] bytes) {
      var header=Header();
      if(bytes.Length<header.Length || !bytes.Take(header.Length).SequenceEqual(header)) throw new IOException("journal_wal_base_mismatch_or_incomplete");
      int offset=header.Length;
      while(offset<bytes.Length) {
        if(bytes.Length-offset<74) throw new IOException("journal_wal_incomplete_review_required");
        string size=Encoding.ASCII.GetString(bytes,offset,8);
        int length;
        if(!Regex.IsMatch(size,"^[0-9a-f]{8}$") || !Int32.TryParse(size,System.Globalization.NumberStyles.HexNumber,null,out length) || length>MaxState || length<2 || bytes[offset+8]!=10)
          throw new IOException("journal_wal_frame_invalid");
        string expected=Encoding.ASCII.GetString(bytes,offset+9,64);
        if(bytes[offset+73]!=10 || bytes.Length-offset<75+length) throw new IOException("journal_wal_incomplete_review_required");
        var state=new byte[length]; Buffer.BlockCopy(bytes,offset+74,state,0,length);
        if(bytes[offset+74+length]!=10 || Hash(state)!=expected) throw new IOException("journal_wal_digest_mismatch");
        State(state); latest=state; offset+=75+length;
        if(++records>256) throw new IOException("journal_wal_limit_review_required");
      }
      walBytes=bytes.Length;
    }
    public void Verify() {
      if(closed || poisoned) throw new IOException("journal_session_unavailable");
      chain.VerifyUnchanged();
      foreach(var file in files.Values) file.Verify();
      if(operationLock!=null) operationLock.Verify();
      if(wal!=null) wal.Verify();
      var observed=new HashSet<string>(Directory.GetFileSystemEntries(directory).Select(Path.GetFileName),StringComparer.OrdinalIgnoreCase);
      if(!names.SetEquals(observed)) throw new IOException("journal_evidence_set_changed");
    }
    public string Read(string name) {
      Verify();
      if(name=="state.json") return latest==null ? null : Convert.ToBase64String(latest);
      if(name!="source-binding.json" && name!="approval.json" && name!="consents.json" && !Regex.IsMatch(name,@"^hosted-dpl_[A-Za-z0-9]+\.json$")) throw new IOException("journal_read_name_invalid");
      if(!files.ContainsKey(name)) return null;
      var bytes=files[name].Read(MaxState); Verify(); return Convert.ToBase64String(bytes);
    }
    public void Save(string encoded) {
      if(inspectOnly) throw new IOException("journal_inspection_is_read_only");
      Verify(); var bytes=Convert.FromBase64String(encoded); State(bytes);
      if(records>=256 || walBytes+bytes.Length+75>MaxWal) throw new IOException("journal_wal_limit_review_required");
      if(wal==null) {
        wal=new PinnedEvidence(Path.Combine(directory,WalName),true,true); names.Add(WalName);
        var header=Header(); wal.Append(header); walBytes=header.Length;
      }
      var prefix=Utf8.GetBytes(bytes.Length.ToString("x8")+"\n"+Hash(bytes)+"\n");
      var frame=new byte[prefix.Length+bytes.Length+1];
      Buffer.BlockCopy(prefix,0,frame,0,prefix.Length); Buffer.BlockCopy(bytes,0,frame,prefix.Length,bytes.Length); frame[frame.Length-1]=10;
      // No rename or reopen by path; same validated writable handle, append + flush.
      Verify(); wal.Append(frame); Verify();
      latest=bytes; records++; walBytes+=frame.Length;
    }
    public object Inspection() { Verify(); return new {staleLock=names.Contains("operation.lock"),records=records,state=Read("state.json"),binding=Read("source-binding.json"),automaticRecovery=false}; }
    public void Poison() { poisoned=true; }
    public void Complete() {
      Verify();
      if(operationLock!=null) { operationLock.DeleteCompletedLock(); operationLock.Dispose(); operationLock=null; }
      closed=true;
    }
    public void Dispose() {
      // Disposal, pipe EOF and process failure NEVER delete the lock or WAL.
      if(operationLock!=null) operationLock.Dispose();
      if(wal!=null) wal.Dispose();
      foreach(var file in files.Values) file.Dispose();
      chain.Dispose(); closed=true;
    }
  }
  public static class Broker {
    [System.Runtime.InteropServices.DllImport("kernel32.dll",SetLastError=true)]
    static extern bool GetNamedPipeClientProcessId(Microsoft.Win32.SafeHandles.SafePipeHandle pipe,out uint process);
    static string Receive(StreamReader reader) {
      // One local client. Bound the line before allocating an unbounded string.
      var text=new StringBuilder();
      while(true) {
        int ch=reader.Read(); if(ch<0) { if(text.Length==0) return null; throw new IOException("broker_incomplete_request"); }
        if(ch==10) return text.ToString();
        if(text.Length>=842451) throw new IOException("broker_request_too_large");
        text.Append((char)ch);
      }
    }
    public static void Run(string pipeName,string directory,int parentPid,bool inspect) {
      if(!Regex.IsMatch(pipeName,"^iom-nr-[a-f0-9]{48}$")) throw new IOException("broker_pipe_invalid");
      var security=new PipeSecurity(); security.SetAccessRuleProtection(true,false);
      security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier("S-1-5-2"),PipeAccessRights.FullControl,AccessControlType.Deny));
      security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(Policy.User),PipeAccessRights.FullControl,AccessControlType.Allow));
      using(var pipe=new NamedPipeServerStream(pipeName,PipeDirection.InOut,1,PipeTransmissionMode.Byte,PipeOptions.Asynchronous,4096,4096,security)) {
        var connection=pipe.WaitForConnectionAsync(); if(!connection.Wait(15000)) return;
        uint actual;
        if(!GetNamedPipeClientProcessId(pipe.SafePipeHandle,out actual) || actual!=(uint)parentPid) throw new IOException("broker_client_identity_invalid");
        using(var reader=new StreamReader(pipe,new UTF8Encoding(false,true),false,4096,true))
        using(var writer=new StreamWriter(pipe,new UTF8Encoding(false),4096,true) {AutoFlush=true}) {
          var json=new JavaScriptSerializer {MaxJsonLength=1000000,RecursionLimit=64};
          Session session=null;
          try {
            while(true) {
              var pending=Task.Factory.StartNew(()=>Receive(reader));
              if(!pending.Wait(TimeSpan.FromMinutes(10))) return;
              var line=pending.Result; if(line==null) return;
              bool end=false;
              object result=null;
              try {
                var request=json.Deserialize<Dictionary<string,object>>(line);
                string method=(string)request["method"];
                if(method=="init") {
                  if(session!=null) throw new IOException("broker_already_initialized");
                  session=new Session(directory,inspect); result=true;
                } else {
                  if(session==null) throw new IOException("broker_not_initialized");
                  switch(method) {
                    case "read": result=session.Read((string)request["name"]); break;
                    case "save": session.Save((string)request["data"]); result=true; break;
                    case "verify": session.Verify(); result=true; break;
                    case "inspect": if(!inspect) throw new IOException("broker_inspection_required"); result=session.Inspection(); break;
                    case "close": if(!inspect) session.Complete(); result=true; end=true; break;
                    case "abandon": session.Poison(); result=true; end=true; break;
                    default: throw new IOException("broker_method_invalid");
                  }
                }
                // A completed/abandoned close is acknowledged only AFTER all
                // retained handles have been released. No close/rename race.
                if(end && session!=null) { session.Dispose(); session=null; }
                writer.WriteLine(json.Serialize(new {ok=true,result=result}));
              } catch(Exception error) {
                if(session!=null) { session.Poison(); session.Dispose(); session=null; }
                string code=error.Message;
                if(!Regex.IsMatch(code,"^[a-z0-9_]+$")) code="journal_operation_failed_review_required";
                writer.WriteLine(json.Serialize(new {ok=false,error=code})); end=true;
              }
              if(end) return;
            }
          } finally { if(session!=null) session.Dispose(); }
        }
      }
    }
  }
}
