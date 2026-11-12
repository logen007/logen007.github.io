import path from 'node:path';

// Discover the complete static graph in the HTML request, without downloading
// editors, video SDKs or other features that remain behind dynamic imports.
export function modulePreloads(outputs,entryPoints){
  const files=new Map(Object.entries(outputs).map(([file,metadata])=>[path.resolve(file),{file,metadata}]));
  const visited=new Set(),links=[];
  const visit=file=>{
    const key=path.resolve(file),output=files.get(key);
    if(!output||visited.has(key))return;
    visited.add(key);
    links.push('/assets/'+path.basename(output.file));
    for(const dependency of output.metadata.imports||[]){
      if(dependency.external||dependency.kind!=='import-statement')continue;
      visit(files.has(path.resolve(dependency.path))?dependency.path:path.resolve(path.dirname(key),dependency.path));
    }
  };
  for(const [file,metadata] of Object.entries(outputs))if(entryPoints.includes(metadata.entryPoint))visit(file);
  return links.map(href=>`<link rel="modulepreload" href="${href}">`).join('\n');
}
