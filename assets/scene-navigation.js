/** Keep view choices explicit in station navigation; map pins stay terrain links. */
export function sceneModeFromHash(hash=''){
  return /^#?station\/[^/]+\/(model|bridgehead|deck|pavilion)$/.test(hash)?'model':'terrain';
}
export function stationViewHref(id,mode='terrain'){
  return '#station/'+id+(mode==='model'?'/model':'');
}
export function museumSceneHref(id,originHash){
  return stationViewHref(id,sceneModeFromHash(originHash));
}
