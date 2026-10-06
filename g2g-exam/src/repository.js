import {hasApiBackend} from './config.js';
import {ApiRepository} from './repositories/api.js';
import {LocalRepository} from './repositories/local.js';

export async function createRepository(){
  const repo=hasApiBackend()?new ApiRepository():new LocalRepository();
  return repo.init();
}
