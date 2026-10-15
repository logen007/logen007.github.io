#!/usr/bin/env node
// Render a libpq service entry from a PostgreSQL URI without exposing secrets
// in a child process command line.  URI query parameters are retained so
// socket, TLS, and other libpq settings have the same meaning as the source.
import {writeFileSync} from 'node:fs';

const [uri, destination]=process.argv.slice(2);
if(!uri||!destination) throw Error('Usage: libpq-service.mjs POSTGRES_URI DESTINATION');
// WHATWG URL rejects libpq's valid empty-authority socket form
// (postgresql://user@/database?host=/socket). Parse it with a harmless
// placeholder while remembering not to emit that placeholder as a host.
const socketAuthority=/^(postgres(?:ql)?:\/\/[^/?#]*)\/(.*)$/i.exec(uri);
const syntheticHost=Boolean(socketAuthority&&socketAuthority[1].endsWith('@')) || /^(postgres(?:ql)?:\/\/)\//i.test(uri);
const parsed=new URL(syntheticHost ? uri.replace(/^(postgres(?:ql)?:\/\/[^/?#]*)\//i,'$1localhost/') : uri);
if(parsed.protocol!=='postgres:'&&parsed.protocol!=='postgresql:') throw Error('DATABASE_URL must use postgres:// or postgresql://');
if(!parsed.pathname||parsed.pathname==='/') throw Error('DATABASE_URL must include a database name');
const values=new Map();
const add=(key,value)=>{
  if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) throw Error(`Invalid libpq parameter: ${key}`);
  if(/[\r\n\0]/.test(value)) throw Error(`Unsafe libpq parameter: ${key}`);
  values.set(key,value);
};
if(parsed.hostname&&!syntheticHost) add('host',parsed.hostname);
if(parsed.port) add('port',parsed.port);
if(parsed.username) add('user',decodeURIComponent(parsed.username));
if(parsed.password) add('password',decodeURIComponent(parsed.password));
add('dbname',decodeURIComponent(parsed.pathname.slice(1)));
for(const [key,value] of parsed.searchParams) add(key,value);
writeFileSync(destination,`[g2g_backup_capture]\n${[...values].map(([key,value])=>`${key}=${value}`).join('\n')}\n`,{mode:0o600});
