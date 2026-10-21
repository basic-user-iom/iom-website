/** Exact critically damped response. Retargeting preserves both value and velocity. */
export class SmoothDimmer {
  value:number;
  target:number;
  private velocity=0;
  constructor(value=0,private frequency=7){this.value=this.target=value;}
  setTarget(value:number){this.target=Math.max(0,Math.min(1,value));}
  get moving(){return this.value!==this.target||this.velocity!==0;}
  advance(seconds:number){
    if(!this.moving||seconds<=0)return;
    const offset=this.value-this.target,term=this.velocity+this.frequency*offset;
    const decay=Math.exp(-this.frequency*seconds);
    this.value=this.target+(offset+term*seconds)*decay;
    this.velocity=(this.velocity-this.frequency*term*seconds)*decay;
    if(this.value<0||this.value>1){this.value=Math.max(0,Math.min(1,this.value));this.velocity=0;}
    if(Math.abs(this.value-this.target)<.0001&&Math.abs(this.velocity)<.001){this.value=this.target;this.velocity=0;}
  }
}
