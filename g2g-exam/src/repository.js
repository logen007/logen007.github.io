import {hasApiBackend} from './config.js';
import {ApiRepository} from './repositories/api.js';
import {LocalRepository} from './repositories/local.js';

export async function createRepository(){
  const demo=Boolean(globalThis.G2G_DEMO_BYPASS);
  const repo=demo ? new LocalRepository() : (hasApiBackend() ? new ApiRepository() : new LocalRepository());
  return repo.init();
}
