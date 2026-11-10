// Isolated phase16 adapter. No provisioning, privilege enabling or network client.
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32.SafeHandles;

namespace IomJournal {
  public sealed class Facts {
    public string Path, Identity, Owner, DescriptorSha256;
    public bool Directory, Reparse, DaclPresent, Protected;
    public uint Links;
    public long Created;
    public RawSecurityDescriptor Security;
  }
  public static class Native {
    [StructLayout(LayoutKind.Sequential)] public struct FileInfo {
      public uint Attributes;
      public System.Runtime.InteropServices.ComTypes.FILETIME Creation, Access, Write;
      public uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
    }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern SafeFileHandle CreateFileW(string p,uint access,uint share,IntPtr sa,uint disposition,uint flags,IntPtr template);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool GetFileInformationByHandle(SafeFileHandle h,out FileInfo info);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern uint GetFinalPathNameByHandleW(SafeFileHandle h,StringBuilder p,uint length,uint flags);
    [DllImport("advapi32.dll", SetLastError=true)]
    static extern uint GetSecurityInfo(SafeFileHandle h,uint type,uint info,out IntPtr owner,out IntPtr group,out IntPtr dacl,out IntPtr sacl,out IntPtr sd);
    [DllImport("advapi32.dll")] static extern uint GetSecurityDescriptorLength(IntPtr sd);
    [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr p);
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool SetFileInformationByHandle(SafeFileHandle h,int kind,ref int data,uint size);
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool ReadFile(SafeFileHandle h,byte[] bytes,uint count,out uint read,IntPtr overlap);
    [DllImport("kernel32.dll", SetLastError=true)]
    static extern bool WriteFile(SafeFileHandle h,byte[] bytes,uint count,out uint written,IntPtr overlap);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool FlushFileBuffers(SafeFileHandle h);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetFilePointerEx(SafeFileHandle h,long offset,out long position,uint method);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] public static extern uint GetDriveTypeW(string root);

    public static string Canonical(string p) {
      if (String.IsNullOrEmpty(p) || p.Length < 3 || !Char.IsLetter(p[0]) || p[1] != ':' || p[2] != '\\' || p.IndexOf(':',2) >= 0)
        throw new IOException("local_absolute_path_required");
      string full=System.IO.Path.GetFullPath(p);
      foreach(string segment in full.Substring(3).Split('\\'))
        if(segment.EndsWith(".") || segment.EndsWith(" ")) throw new IOException("ambiguous_path");
      return full.Length == 3 ? full : full.TrimEnd('\\');
    }
    public static SafeFileHandle Open(string p,uint access,uint disposition,bool directory,uint sharing=1) {
      // Never share DELETE. Leaf/evidence also refuse shared WRITE. Ancestors
      // allow WRITE to avoid obstructing unrelated parent-directory operations;
      // their pinned child cannot be removed and their private-chain policy is checked.
      // Never enable backup privileges.
      SafeFileHandle h=CreateFileW(Canonical(p),access,sharing,IntPtr.Zero,disposition,
        0x00200000u | (directory ? 0x02000000u : 0u),IntPtr.Zero);
      if(h.IsInvalid) { int error=Marshal.GetLastWin32Error(); h.Dispose(); throw new Win32Exception(error,"handle_open_failed"); }
      return h;
    }
    public static Facts Inspect(SafeFileHandle h) {
      FileInfo info;
      if(!GetFileInformationByHandle(h,out info)) throw new Win32Exception(Marshal.GetLastWin32Error(),"handle_info_failed");
      var path=new StringBuilder(32768);
      uint n=GetFinalPathNameByHandleW(h,path,(uint)path.Capacity,0);
      if(n==0 || n>=path.Capacity) throw new IOException("handle_path_unverified");
      string final=path.ToString();
      if(!final.StartsWith(@"\\?\")) throw new IOException("handle_path_unverified");
      final=Canonical(final.Substring(4));
      IntPtr owner,group,dacl,sacl,sd;
      uint code=GetSecurityInfo(h,1,1|4,out owner,out group,out dacl,out sacl,out sd);
      if(code!=0) throw new Win32Exception((int)code,"handle_security_unverified");
      try {
        uint length=GetSecurityDescriptorLength(sd);
        if(length==0 || length>65536) throw new IOException("handle_security_size_invalid");
        var bytes=new byte[length]; Marshal.Copy(sd,bytes,0,(int)length);
        var raw=new RawSecurityDescriptor(bytes,0);
        string hash;
        using(var sha=SHA256.Create()) { hash=BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-","").ToLowerInvariant(); }
        return new Facts { Path=final, Identity=info.Volume.ToString("x8")+":"+info.IndexHigh.ToString("x8")+info.IndexLow.ToString("x8"),
          Owner=raw.Owner==null ? "" : raw.Owner.Value, DescriptorSha256=hash, Directory=(info.Attributes & 0x10)!=0,
          Reparse=(info.Attributes & 0x400)!=0, Links=info.Links,
          DaclPresent=(raw.ControlFlags & ControlFlags.DiscretionaryAclPresent)!=0 && raw.DiscretionaryAcl!=null,
          Protected=(raw.ControlFlags & ControlFlags.DiscretionaryAclProtected)!=0,
          Created=((long)info.Creation.dwHighDateTime<<32)|(uint)info.Creation.dwLowDateTime,Security=raw };
      } finally { LocalFree(sd); }
    }
    public static void RequireObject(Facts f,string path,bool directory) {
      if(f.Reparse || f.Directory!=directory || (!directory && f.Links!=1) ||
        !String.Equals(f.Path,Canonical(path),StringComparison.OrdinalIgnoreCase)) throw new IOException("handle_object_rejected");
      if(!f.DaclPresent || String.IsNullOrEmpty(f.Owner)) throw new IOException("handle_security_unverified");
    }
    public static void Seek(SafeFileHandle h,uint method) {
      long position;
      if(!SetFilePointerEx(h,0,out position,method)) throw new IOException("handle_seek_failed");
    }
    public static byte[] Read(SafeFileHandle h,int maximum) {
      Seek(h,0);
      using(var output=new MemoryStream()) {
        var buffer=new byte[16384]; uint read;
        while(true) {
          if(!ReadFile(h,buffer,(uint)buffer.Length,out read,IntPtr.Zero)) throw new IOException("handle_read_failed");
          if(read==0) break;
          if(output.Length+read>maximum) throw new IOException("handle_read_too_large");
          output.Write(buffer,0,(int)read);
        }
        return output.ToArray();
      }
    }
    public static void Write(SafeFileHandle h,byte[] bytes) {
      if(bytes.Length>669816+128) throw new IOException("handle_write_too_large");
      uint count;
      if(!WriteFile(h,bytes,(uint)bytes.Length,out count,IntPtr.Zero) || count!=bytes.Length || !FlushFileBuffers(h))
        throw new IOException("handle_write_failed_unknown_outcome");
    }
    public static void DeleteSameObject(SafeFileHandle h) {
      int mark=1;
      if(!SetFileInformationByHandle(h,4,ref mark,4)) throw new Win32Exception(Marshal.GetLastWin32Error(),"handle_delete_failed");
    }
  }
  public sealed class PinnedChain : IDisposable {
    readonly List<SafeFileHandle> handles=new List<SafeFileHandle>();
    readonly List<Facts> initial=new List<Facts>();
    public Facts[] Facts { get { return initial.ToArray(); } }
    public PinnedChain(string leaf) {
      string full=Native.Canonical(leaf), current=full;
      var paths=new List<string>();
      while(current!=null) { paths.Add(current); current=System.IO.Path.GetDirectoryName(current); }
      paths.Reverse();
      try {
        foreach(string p in paths) {
          // Include FILE_LIST_DIRECTORY: metadata-only access does not provide
          // the expected sharing exclusion on Windows directory renames.
          var h=Native.Open(p,0x20000|0x80|0x1,3,true,p==full ? 1u : 3u); handles.Add(h);
          var f=Native.Inspect(h); Native.RequireObject(f,p,true);
          Policy.Directory(f,p==full,paths.IndexOf(p)==paths.Count-2);
          initial.Add(f);
        }
      } catch(Win32Exception error) {
        Dispose();
        if(error.NativeErrorCode==2 || error.NativeErrorCode==3)throw new IOException("needs_review_journal_directory_missing");
        throw;
      } catch { Dispose(); throw; }
    }
    public void VerifyUnchanged() {
      if(handles.Count==0) throw new ObjectDisposedException("PinnedChain");
      for(int i=0;i<handles.Count;i++) {
        var f=Native.Inspect(handles[i]);
        if(f.Identity!=initial[i].Identity || f.DescriptorSha256!=initial[i].DescriptorSha256 || f.Path!=initial[i].Path || f.Created!=initial[i].Created || f.Reparse)
          throw new IOException("needs_review_journal_rights_changed");
      }
    }
    public void Dispose() { for(int i=handles.Count-1;i>=0;i--) handles[i].Dispose(); handles.Clear(); }
  }
  public sealed class PinnedEvidence : IDisposable {
    readonly SafeFileHandle handle;
    public readonly Facts Initial;
    public PinnedEvidence(string path,bool create,bool writable) {
      handle=Native.Open(path,create ? 0xC0030000u : writable ? 0xC0020000u : 0x80020000u,create ? 1u : 3u,false);
      try { Initial=Native.Inspect(handle); Native.RequireObject(Initial,path,false); Policy.File(Initial); }
      catch { handle.Dispose(); throw; }
    }
    public Facts Inspect() { return Native.Inspect(handle); }
    public void Verify() {
      var f=Inspect(); Policy.File(f);
      if(f.Identity!=Initial.Identity || f.DescriptorSha256!=Initial.DescriptorSha256 || f.Path!=Initial.Path || f.Created!=Initial.Created || f.Links!=1 || f.Reparse)
        throw new IOException("pinned_evidence_changed");
    }
    public byte[] Read(int maximum) { Verify(); var bytes=Native.Read(handle,maximum); Verify(); return bytes; }
    public void Append(byte[] bytes) { Verify(); Native.Seek(handle,2); Native.Write(handle,bytes); Verify(); }
    public void DeleteCompletedLock() { Native.DeleteSameObject(handle); }
    public void Dispose() { handle.Dispose(); }
  }
  public static class Policy {
    public static readonly string User=System.Security.Principal.WindowsIdentity.GetCurrent().User.Value;
    static readonly string[] Allowed={User,"S-1-5-18","S-1-5-32-544"};
    static bool Trusted(string sid) { return Array.IndexOf(Allowed,sid)>=0; }
    static CommonAce Ace(GenericAce a) {
      var ace=a as CommonAce;
      if(ace==null || ace.IsCallback || ace.AceQualifier!=AceQualifier.AccessAllowed) throw new IOException("needs_review_journal_dacl_unverified");
      return ace;
    }
    public static void Directory(Facts f,bool leaf,bool immediate) {
      if(!f.DaclPresent || !f.Directory || f.Reparse) throw new IOException("journal_directory_unverified");
      if(leaf) {
        if(f.Owner!=User) throw new IOException("needs_review_journal_owner_unverified");
        if(!f.Protected) throw new IOException("needs_review_journal_dacl_unverified");
        var found=new HashSet<string>();
        foreach(GenericAce raw in f.Security.DiscretionaryAcl) {
          var a=Ace(raw); var sid=a.SecurityIdentifier.Value;
          if(!Trusted(sid) || a.AccessMask!=2032127 || (int)a.AceFlags!=3) throw new IOException("needs_review_journal_dacl_unverified");
          found.Add(sid);
        }
        if(found.Count!=3) throw new IOException("needs_review_journal_dacl_unverified");
        return;
      }
      bool fixedRoot=f.Path.Length==3 && Native.GetDriveTypeW(f.Path)==3;
      if(!Trusted(f.Owner) && !(fixedRoot && f.Owner=="S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464"))
        throw new IOException("journal_parent_unverified");
      uint mask=0x2|0x10|0x40|0x100|0x10000|0x40000|0x80000|0x10000000|0x40000000;
      if(immediate) mask|=4;
      foreach(GenericAce raw in f.Security.DiscretionaryAcl) {
        if((raw.AceFlags & AceFlags.InheritOnly)!=0) continue;
        var a=Ace(raw);
        if(!Trusted(a.SecurityIdentifier.Value) && ((uint)a.AccessMask & mask)!=0) throw new IOException("journal_parent_unverified");
      }
    }
    public static void File(Facts f) {
      if(!f.DaclPresent || !Trusted(f.Owner) || f.Directory || f.Reparse || f.Links!=1) throw new IOException("journal_file_unverified");
      foreach(GenericAce raw in f.Security.DiscretionaryAcl) if(!Trusted(Ace(raw).SecurityIdentifier.Value)) throw new IOException("needs_review_journal_dacl_unverified");
    }
  }
}
