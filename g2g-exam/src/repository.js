import {hasApiBackend} from './config.js';
import {ApiRepository} from './repositories/api.js';
import {LocalRepository} from './repositories/local.js';

export async function createRepository(){
  // A configured backend must never silently fall back to browser/demo storage.
  const repo=hasApiBackend() ? new ApiRepository() : new LocalRepository();
  return repo.init();
}
