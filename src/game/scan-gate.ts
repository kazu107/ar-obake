/** Only an uninterrupted, known marker can expose a hint or enter the answer screen. */
export class ScanGate {
  private visible: {id:string;since:number}|undefined;
  constructor(private readonly ids:readonly string[],private readonly dwellMs=450){}
  found(id:string,now:number) { if(!this.ids.includes(id)||!Number.isFinite(now))return;if(this.visible?.id!==id)this.visible={id,since:now}; }
  lost(id:string) { if(this.visible?.id===id)this.visible=undefined; }
  reset() { this.visible=undefined; }
  eligible(now:number):string|undefined { return this.visible&&now-this.visible.since>=this.dwellMs?this.visible.id:undefined; }
}
