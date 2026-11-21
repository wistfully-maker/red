// Screened ink on paper. Work in normalized scene space so adjoining stone
// pieces and water triangles keep a continuous pattern as the camera orbits.
const swatches = {
  paper: '#e6e1d7', plaster: '#dedad1', stone: '#aaa9a3', lightstone: '#cdc9bf',
  rock: '#979790', sand: '#cac5b9', timber: '#615e59', wood: '#99938a',
  tile: '#545657', tilerib: '#777874', recess: '#30343a', iron: '#404245',
  foliage: '#73756e', leaflight: '#989b91', water: '#939a98', ripple: '#d6d7cd',
  red: '#c83232', cloth: '#a7a497', 'Paper limestone': '#d8d2c7',
  'Snow chalk': '#f2f0e8', 'Weathered ash timber': '#76736c',
  'Charcoal recess': '#30343a', 'Pale shale': '#a6a59e',
  'Signal red cloth': '#c83232', 'Still grey water': '#9caaa7'
};

export function printMaterial(material) {
  const name = material.name;
  if (swatches[name]) material.color.set(swatches[name]);
  const water = /water/i.test(name);
  const rock = /rock|stone|shale|sand/i.test(name);
  const wood = /wood|timber/i.test(name);
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 platePoint;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nplatePoint = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 platePoint;
      float paperHash(vec2 p) {
        vec3 q = fract(vec3(p.xyx) * vec3(.1031, .11369, .13787));
        q += dot(q, q.yzx + 19.19);
        return fract((q.x + q.y) * q.z);
      }
      float paperNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3. - 2. * f);
        return mix(mix(paperHash(i), paperHash(i+vec2(1,0)), f.x),
                   mix(paperHash(i+vec2(0,1)),paperHash(i+vec2(1,1)),f.x), f.y);
      }
    `).replace('#include <color_fragment>', `#include <color_fragment>
       vec2 plane = platePoint.xz + vec2(.47,1.6)*platePoint.y;
       float fleck = paperNoise(plane*83.);
       diffuseColor.rgb *= .97 + .055*fleck;
       ${water ? `
         vec2 flow = vec2(plane.x*7.,plane.y*37.);
         float waves = paperNoise(flow + vec2(0.,1.5*paperNoise(plane*7.)));
         float glint = smoothstep(.54,.8,waves);
         diffuseColor.rgb = mix(diffuseColor.rgb*(.72+.24*waves), vec3(.77,.78,.74), .64*glint);
       ` : rock ? `
         float bed = platePoint.y + .16*plane.x + .023*paperNoise(plane*12.);
         float layers = paperNoise(vec2(plane.x*8.,bed*53.));
         diffuseColor.rgb *= .82 + .27*layers + .08*fleck;
       ` : wood ? `
         float fibre = paperNoise(vec2(plane.x*13.,plane.y*109.));
         diffuseColor.rgb *= .83+.3*fibre;
       ` : ''}
    `);
  };
  material.customProgramCacheKey = () => water ? 'plate-water' : rock ? 'plate-stone' : wood ? 'plate-timber' : 'plate';
}
