/**
 * Earth ↔ Mars command link with one-way light time. Commands sent at time t arrive at t + delay;
 * the vehicle acts only on commands that have arrived. Telemetry seen on Earth is equally old.
 * With 3–22 minutes each way, a human in the loop on Earth cannot fly the vehicle in real time:
 * the vehicle must fly autonomously and hold or land when the link goes stale.
 */
export class DelayedLink {
  constructor(delaySeconds,{staleAfter=2}={}){this.delay=Math.max(0,delaySeconds);this.queue=[];this.current=null;this.lastArrival=-Infinity;this.staleAfter=staleAfter;this.sent=0;this.delivered=0;}
  send(t,command){this.queue.push({arrive:t+this.delay,sent:t,command:structuredClone(command)});this.sent++;}
  /** Commands that have arrived by time t; returns the latest one (or null) and whether the link is stale. */
  receive(t){
    while(this.queue.length&&this.queue[0].arrive<=t){const c=this.queue.shift();this.current=c;this.lastArrival=c.arrive;this.delivered++;}
    return {command:this.current?.command??null,age:this.current?t-this.current.sent:Infinity,stale:t-this.lastArrival>this.staleAfter&&this.delay>0,
      nextArrival:this.queue[0]?.arrive??null};
  }
}
