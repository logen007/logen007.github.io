import {monthlyDue} from './retention.mjs';
process.exitCode=monthlyDue(process.argv[2]||'')?0:1;
