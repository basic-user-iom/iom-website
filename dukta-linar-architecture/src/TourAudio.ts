/** Gallery of Light's owner-supplied soundtrack, mixed once into one continuous stream. */
export class TourAudio {
 muted=false;
 private media?:HTMLAudioElement;
 private desiredPlaying=false;
 private generation=0;
 private error='';
 private starts=0;
 constructor(private changed:()=>void=()=>{}) {}
 private create() {
  if(this.media)return this.media;
  const media=this.media=new Audio();
  media.preload='none';media.loop=true;media.muted=this.muted;
  media.setAttribute('playsinline','');
  media.src=new URL('audio/gallery-of-light-tour.m4a',document.baseURI).href;
  media.addEventListener('error',()=>{this.desiredPlaying=false;this.error='Music could not load. Try again.';this.changed();});
  return media;
 }
 /** A new tour/replay starts the full track; resume never seeks or recreates it. */
 start() {
  if(this.media){this.media.pause();this.media.currentTime=0;}
  this.play();
 }
 play() {
  this.desiredPlaying=true;const generation=++this.generation;this.error='';
  try {
   const media=this.create();if(media.error)media.load();
   // Keep this call synchronous with the Start/Resume/Retry user gesture.
   const playing=media.play();this.starts++;
   void playing.then(()=>{if(generation===this.generation)this.changed();}).catch(error=>{
    if(generation!==this.generation||!this.desiredPlaying)return;
    this.desiredPlaying=false;this.error=error?.name==='NotAllowedError'?'Press Retry music to enable sound.':'Music could not play. Try again.';this.changed();
   });
  } catch {this.desiredPlaying=false;this.error='Music could not start. Try again.';this.changed();}
 }
 pause() {this.desiredPlaying=false;this.generation++;this.media?.pause();}
 toggleMute() {this.muted=!this.muted;if(this.media)this.media.muted=this.muted;return this.muted;}
 inspect() {
  const media=this.media;
  return {track:'Gallery of Light',muted:this.muted,playing:!!media&&!media.paused&&this.desiredPlaying,
   paused:media?.paused??true,mediaInstances:media?1:0,currentTime:media?.currentTime??0,
   duration:media&&Number.isFinite(media.duration)?media.duration:0,readyState:media?.readyState??0,
   loop:media?.loop??false,playCalls:this.starts,source:media?.currentSrc??'',error:this.error};
 }
}
