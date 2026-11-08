/**
 * Rigid-body mass properties from elements: point masses, solid boxes, spheres, tubes (hollow
 * cylinders between two points) and thin panels. Exact element inertias, parallel-axis theorem,
 * principal axes by Jacobi diagonalisation. Units: kg, m, kg·m². Body axes: +X right, +Y up, −Z forward.
 */
const zero3=()=>[[0,0,0],[0,0,0],[0,0,0]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const len=a=>Math.hypot(a[0],a[1],a[2]);

/** Inertia tensor of a body with principal moments (along local axes) rotated so local Z ‖ axis `d`. */
function axisTensor(Iaxial,Itrans,d){
  const n=len(d)||1,u=[d[0]/n,d[1]/n,d[2]/n],I=zero3();
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)I[i][j]=Itrans*((i===j?1:0)-u[i]*u[j])+Iaxial*u[i]*u[j];
  return I;
}

export class MassBuilder {
  constructor(){this.items=[];}
  add(group,name,mass,center,tensor){
    if(!(mass>=0)||!center.every(Number.isFinite))throw new RangeError(`Bad mass element '${name}'`);
    if(mass>0)this.items.push({group,name,mass,center:[...center],tensor});return this;
  }
  point(group,name,mass,p){return this.add(group,name,mass,p,zero3());}
  sphere(group,name,mass,p,r){const i=.4*mass*r*r;return this.add(group,name,mass,p,[[i,0,0],[0,i,0],[0,0,i]]);}
  /** Solid box, axis-aligned, full size [sx, sy, sz]. */
  box(group,name,mass,p,[sx,sy,sz]){
    const k=mass/12;return this.add(group,name,mass,p,[[k*(sy*sy+sz*sz),0,0],[0,k*(sx*sx+sz*sz),0],[0,0,k*(sx*sx+sy*sy)]]);
  }
  /** Hollow tube from a to b; mass from density unless `mass` given. Returns the mass used. */
  tube(group,name,a,b,od,id,density,mass=null){
    const L=len(sub(b,a)),ro=od/2,ri=id/2,m=mass??density*Math.PI*(ro*ro-ri*ri)*L;
    const c=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2];
    this.add(group,name,m,c,axisTensor(.5*m*(ro*ro+ri*ri),m*(3*(ro*ro+ri*ri)+L*L)/12,sub(b,a)));
    return m;
  }
  /** Thin panel (lamina) with in-plane extents w × h, normal n, in-plane width direction u. */
  panel(group,name,mass,c,u,n,w,h){
    // local: x = u (width), y = v (height), z = n (normal)
    const nu=len(u),nn=len(n),U=u.map(x=>x/nu),N=n.map(x=>x/nn);
    const V=[N[1]*U[2]-N[2]*U[1],N[2]*U[0]-N[0]*U[2],N[0]*U[1]-N[1]*U[0]];
    const Ix=mass*h*h/12,Iy=mass*w*w/12,Iz=mass*(w*w+h*h)/12,I=zero3();
    for(let i=0;i<3;i++)for(let j=0;j<3;j++)I[i][j]=Ix*U[i]*U[j]+Iy*V[i]*V[j]+Iz*N[i]*N[j];
    return this.add(group,name,mass,c,I);
  }
  merge(other,prefix=''){for(const it of other.items)this.items.push({...it,name:prefix+it.name});return this;}
  /** Totals: mass, centre of mass, inertia about the CoM (body axes), principal moments and axes. */
  compute(){
    let m=0;const c=[0,0,0];
    for(const it of this.items){m+=it.mass;for(let k=0;k<3;k++)c[k]+=it.mass*it.center[k];}
    if(!(m>0))throw new RangeError('No mass');
    for(let k=0;k<3;k++)c[k]/=m;
    const I=zero3();
    for(const it of this.items){
      const d=sub(it.center,c),d2=d[0]*d[0]+d[1]*d[1]+d[2]*d[2];
      for(let i=0;i<3;i++)for(let j=0;j<3;j++)I[i][j]+=it.tensor[i][j]+it.mass*((i===j?d2:0)-d[i]*d[j]);
    }
    const groups={};for(const it of this.items)groups[it.group]=(groups[it.group]??0)+it.mass;
    return {mass:m,com:c,inertia:I,principal:principalAxes(I),groups};
  }
}

/** Jacobi eigen-decomposition of a symmetric 3×3 matrix → {moments [3], axes (columns, right-handed)}. */
export function principalAxes(I){
  const a=I.map(r=>[...r]),v=[[1,0,0],[0,1,0],[0,0,1]];
  for(let sweep=0;sweep<50;sweep++){
    const off=Math.abs(a[0][1])+Math.abs(a[0][2])+Math.abs(a[1][2]);
    if(off<1e-15*(Math.abs(a[0][0])+Math.abs(a[1][1])+Math.abs(a[2][2])+1e-30))break;
    for(const [p,q] of [[0,1],[0,2],[1,2]]){
      if(Math.abs(a[p][q])<1e-300)continue;
      const th=(a[q][q]-a[p][p])/(2*a[p][q]),t=Math.sign(th||1)/(Math.abs(th)+Math.sqrt(th*th+1)),cs=1/Math.sqrt(t*t+1),sn=t*cs;
      for(let k=0;k<3;k++){const akp=a[k][p],akq=a[k][q];a[k][p]=cs*akp-sn*akq;a[k][q]=sn*akp+cs*akq;}
      for(let k=0;k<3;k++){const apk=a[p][k],aqk=a[q][k];a[p][k]=cs*apk-sn*aqk;a[q][k]=sn*apk+cs*aqk;}
      for(let k=0;k<3;k++){const vkp=v[k][p],vkq=v[k][q];v[k][p]=cs*vkp-sn*vkq;v[k][q]=sn*vkp+cs*vkq;}
    }
  }
  // order axes to stay closest to body X, Y, Z (keeps the body frame recognisable)
  const moments=[a[0][0],a[1][1],a[2][2]],cols=[0,1,2].map(j=>[v[0][j],v[1][j],v[2][j]]);
  const order=[0,1,2].map(axis=>{let best=-1,bi=0;for(let j=0;j<3;j++){const s=Math.abs(cols[j][axis]);if(s>best){best=s;bi=j;}}return bi;});
  if(new Set(order).size<3)return {moments,axes:cols};
  const axes=order.map((j,axis)=>{const c=cols[j];return c[axis]<0?c.map(x=>-x):c;});
  const det=axes[0][0]*(axes[1][1]*axes[2][2]-axes[1][2]*axes[2][1])-axes[0][1]*(axes[1][0]*axes[2][2]-axes[1][2]*axes[2][0])+axes[0][2]*(axes[1][0]*axes[2][1]-axes[1][1]*axes[2][0]);
  if(det<0)axes[2]=axes[2].map(x=>-x);
  return {moments:order.map(j=>moments[j]),axes};
}

/** Quaternion {x,y,z,w} of the rotation whose columns are the principal axes. */
export function axesQuaternion(axes){
  const [X,Y,Z]=axes,m00=X[0],m11=Y[1],m22=Z[2],tr=m00+m11+m22;
  let x,y,z,w;
  if(tr>0){const s=.5/Math.sqrt(tr+1);w=.25/s;x=(Y[2]-Z[1])*s;y=(Z[0]-X[2])*s;z=(X[1]-Y[0])*s;}
  else if(m00>m11&&m00>m22){const s=2*Math.sqrt(1+m00-m11-m22);w=(Y[2]-Z[1])/s;x=.25*s;y=(Y[0]+X[1])/s;z=(Z[0]+X[2])/s;}
  else if(m11>m22){const s=2*Math.sqrt(1+m11-m00-m22);w=(Z[0]-X[2])/s;x=(Y[0]+X[1])/s;y=.25*s;z=(Z[1]+Y[2])/s;}
  else{const s=2*Math.sqrt(1+m22-m00-m11);w=(X[1]-Y[0])/s;x=(Z[0]+X[2])/s;y=(Z[1]+Y[2])/s;z=.25*s;}
  const n=Math.hypot(x,y,z,w);return {x:x/n,y:y/n,z:z/n,w:w/n};
}
