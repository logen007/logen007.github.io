import {APP_CONFIG} from '../config.js';
import {clone,normalizeState} from '../core.js';
import {seedState} from '../seed.js';

export class LocalRepository{
  constructor(){
    this.mode='local';
    this.listeners=new Set();
    this.state=null;
    this.currentUserId=sessionStorage.getItem('g2g.demo.user')||null;
  }

  async init(){
    const raw=localStorage.getItem(APP_CONFIG.storageKey);
    try{this.state=raw?normalizeState(JSON.parse(raw)):normalizeState(seedState);}catch{this.state=normalizeState(seedState);}
    if(!raw)this.persist();
    window.addEventListener('storage',event=>{
      if(event.key===APP_CONFIG.storageKey&&event.newValue){
        try{this.state=normalizeState(JSON.parse(event.newValue));this.emit();}catch{}
      }
    });
    return this;
  }

  persist(){
    this.state.revision=(this.state.revision||0)+1;
    localStorage.setItem(APP_CONFIG.storageKey,JSON.stringify(this.state));
    localStorage.setItem(APP_CONFIG.storageRevisionKey,String(this.state.revision));
    this.emit();
  }

  emit(){for(const fn of this.listeners)fn(clone(this.state));}
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  async getState(){return clone(this.state);}

  async replaceState(next){
    this.state=normalizeState(next);
    this.persist();
    return clone(this.state);
  }

  async transaction(mutator){
    const next=clone(this.state);
    const result=await mutator(next);
    this.state=normalizeState(next);
    this.persist();
    return result;
  }

  async signInDemo(userId){
    if(!this.state.users.some(u=>u.id===userId))throw new Error('Tài khoản demo không tồn tại.');
    this.currentUserId=userId;
    this.testRole=null;
    sessionStorage.setItem('g2g.demo.user',userId);
    return clone(this.state.users.find(u=>u.id===userId));
  }

  async signOut(){
    this.currentUserId=null;
    this.testRole=null;
    sessionStorage.removeItem('g2g.demo.user');
  }

  async getCurrentUser(){
    const current=this.currentUserId?clone(this.state.users.find(u=>u.id===this.currentUserId)||null):null;
    return current&&this.testRole?{...current,role:this.testRole,canTestRoles:true}:current;
  }

  async switchTestRole(role){
    const current=this.currentUserId?this.state.users.find(u=>u.id===this.currentUserId):null;
    if(current?.role!=='master')throw new Error('Chỉ tài khoản Admin được đổi vai trò thử nghiệm.');
    if(!['student','teacher','master'].includes(role))throw new Error('Kiểu tài khoản không hợp lệ.');
    this.testRole=role;
    return {...clone(current),role,canTestRoles:true};
  }

  async reset(){
    this.state=normalizeState(seedState);
    this.persist();
  }
}
