/** Original synthesized ambient pad. No recordings, downloads or licensed music. */
export class TourAudio{
 muted=false;private context?:AudioContext;private master?:GainNode;private analyser?:AnalyserNode;private voices:OscillatorNode[]=[];private pauseTimer=0;private generation=0;private playing=false;private error='';
 private create(){if(this.context)return;const context=this.context=new AudioContext(),master=this.master=context.createGain(),filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=900;master.gain.value=0;const analyser=this.analyser=context.createAnalyser();analyser.fftSize=256;filter.connect(master);master.connect(analyser);analyser.connect(context.destination);
  for(const frequency of [130.8128,195.9977,293.6648])for(const detune of [-3,3]){const voice=context.createOscillator(),gain=context.createGain();voice.type='sine';voice.frequency.value=frequency;voice.detune.value=detune;gain.gain.value=.035;voice.connect(gain);gain.connect(filter);voice.start();this.voices.push(voice);}
 }
 private fade(value:number){if(!this.context||!this.master)return;const gain=this.master.gain,t=this.context.currentTime;gain.cancelAndHoldAtTime(t);gain.linearRampToValueAtTime(value,t+.22);}
 play(){this.playing=true;const generation=++this.generation;clearTimeout(this.pauseTimer);try{this.create();void this.context!.resume().then(()=>{if(generation!==this.generation||!this.playing)return;if(this.muted)this.pauseSound();else this.fade(.12);}).catch(e=>{this.error=String(e);});}catch(e){this.error=String(e);}}
 private pauseSound(){this.fade(0);clearTimeout(this.pauseTimer);const generation=this.generation;this.pauseTimer=window.setTimeout(()=>{if(generation===this.generation&&(!this.playing||this.muted))void this.context?.suspend();},260);}
 pause(){this.playing=false;this.generation++;this.pauseSound();}
 toggleMute(){this.muted=!this.muted;if(this.playing){if(this.muted)this.pauseSound();else this.play();}return this.muted;}
 chord(index:number){if(!this.context)return;const notes=[[130.8128,195.9977,293.6648],[110,164.8138,261.6256],[146.8324,220,329.6276],[130.8128,195.9977,293.6648]][Math.floor(index/4)%4];this.voices.forEach((v,i)=>v.frequency.setTargetAtTime(notes[Math.floor(i/2)],this.context!.currentTime,1.5));}
 inspect(){const data=new Float32Array(256);this.analyser?.getFloatTimeDomainData(data);return{muted:this.muted,playing:this.playing,contextState:this.context?.state??'not-created',contexts:this.context?1:0,voices:this.voices.length,rms:Math.sqrt(data.reduce((sum,v)=>sum+v*v,0)/data.length),error:this.error};}
}
