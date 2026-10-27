import {courseUrlSlug} from '../src/domain/course-url.js';
import {writeCourseRoute} from '../src/courses/api.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createPageHistory} from '../src/ui/page-history.js';
import {initialStateScope} from '../src/repositories/state-scope.js';
import {writeSettingsRoute} from '../src/settings/route.js';

function browser(){
  const entries=[{url:'https://exam.test/?tab=exams',state:null}];let at=0,reloads=0,pop;
  const location={get href(){return entries[at].url;},reload(){reloads++;}};
  const history={get state(){return entries[at].state;},replaceState(state,_,url){entries[at]={url:String(url),state};},pushState(state,_,url){entries.splice(++at);entries.push({url:String(url),state});},async go(delta){at+=delta;await pop();}};
  return {location,history,entries,get reloads(){return reloads;},addEventListener(_,fn){pop=fn;},removeEventListener(){pop=null;}};
}
const view=browser();let finishSave;
const navigation=createPageHistory({view,beforeLeave:()=>new Promise(resolve=>finishSave=resolve)});
navigation.sync(view.location.href);
navigation.sync('/?edit=e&section=s1');navigation.sync('/?edit=e&section=s1');
navigation.sync('/?edit=e&section=s2');
assert.equal(view.entries.length,3,'Repeated renders do not add history entries');
const back=view.history.go(-1);
assert.equal(view.reloads,0,'Do not reload before pending edits are saved');
navigation.sync('/?edit=e&section=s2');
assert.match(view.location.href,/section=s1/,'Saving cannot rewrite the Back destination');
finishSave(true);await back;assert.equal(view.reloads,1);
navigation.dispose();
const restored=createPageHistory({view});restored.sync(view.location.href);
await view.history.go(1);assert.equal(view.reloads,2,'Forward survives a page reload');
restored.dispose();
const blocked=browser();let errors=0;
const guard=createPageHistory({view:blocked,beforeLeave:async()=>{throw Error('save failed');},onError:()=>errors++});
guard.sync(blocked.location.href);guard.sync('/?edit=e');
await blocked.history.go(-1);
assert.equal(blocked.reloads,0);assert.match(blocked.location.href,/edit=e/);assert.equal(errors,1);
guard.dispose();

const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const sync=source.slice(source.indexOf('function syncViewUrl(){'),source.indexOf('\nasync function act('));
const context={URL,courseUrlSlug,writeCourseRoute,window:{location:{href:'https://exam.test/?edit=old&class=old'}},user:{role:'master'},isMaster:u=>u.role==='master',writeSettingsRoute,pageHistory:{sync:url=>context.url=new URL(url)},ui:{}};
vm.createContext(context);vm.runInContext(sync,context);
for(const [ui,expected] of [
  [{view:'admin',adminTab:'classes',classId:'class-1'},'?tab=classes&class=class-1'],
  [{view:'admin',adminTab:'settings',settingsTab:'advanced'},'?tab=settings&settings=advanced'],
  [{view:'builder',builderExamId:'e',builderSectionId:'s'},'?edit=e&section=s'],
  [{view:'preview-exam',previewExamId:'e',previewSectionIndex:2},'?preview=e&section=2'],
  [{view:'student-attempt-detail',review:{attempt:{id:'a'}}},'?view=results&attempt=a'],
  [{view:'grading-detail',gradeAttemptId:'a'},'?view=grading&attempt=a'],
  [{view:'student-home'},'?view=home'],
  [{view:'exam',attemptId:'a'},'?view=exam&attempt=a'],
  [{view:'submitted',attemptId:'a'},'?view=submitted&attempt=a'],
  [{view:'expired'},'?view=expired'],
]){context.ui=ui;context.syncViewUrl();assert.equal(context.url.search,expected);}
context.window.location.href='https://exam.test/khoa-hoc/a1';context.ui={view:'student-home'};context.syncViewUrl();assert.equal(context.url.pathname,'/');
context.ui={view:'courses',courseRoute:{page:'detail',id:'course',slug:'a1'}};context.syncViewUrl();assert.equal(context.url.pathname,'/khoa-hoc/a1');assert.equal(context.url.search,'');
assert.equal(initialStateScope({role:'student'},'https://exam.test/?view=home'),'catalog');
console.log('Page history: direct URLs, Back/Forward, reload, deduplication and failed-save protection passed.');
