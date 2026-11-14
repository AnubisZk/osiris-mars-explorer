# Harmonik MEDA modeli: sol 105–107 eğitim, 109–110 test. Kullanım: python3 meda_model.py <CSV klasörü>
# Çıktı: model2.json (katsayılar sistemler.js MEDA_MODEL içine elle aktarılır).
import pandas as pd, numpy as np, glob, json, sys
import sys
KOK=(sys.argv[1] if len(sys.argv)>1 else 'meda_csv').rstrip('/')+'/'   # MEDA DER CSV klasörü (PDS'ten elle indirilir)
def oku(sol,tur):
    f=sorted(glob.glob(KOK+f'**/WE__0{sol}*DER_{tur}_*',recursive=True))
    d=pd.read_csv(f[0]); t=d['LMST'].str.split('M',expand=True)
    gun=t[0].astype(int); hms=t[1].str.split(':',expand=True).astype(float)
    d['saat']=((gun-sol)*24+hms[0]+hms[1]/60+hms[2]/3600)%24
    return d
def kutu(d,kol,dk=10):
    d=d[d[kol]<1e6]; b=(d.saat*60//dk).astype(int); g=d.groupby(b)[kol].median()
    return (g.index.values*dk+dk/2)/60, g.values
def X(h,n):
    c=[np.ones_like(h)]
    for k in range(1,n+1): c+=[np.cos(2*np.pi*k*h/24),np.sin(2*np.pi*k*h/24)]
    return np.column_stack(c)
def r2(y,p): return 1-((y-p)**2).sum()/((y-y.mean())**2).sum()
veri={}
for sol in (105,106,107,109,110):
    ws=oku(sol,'WS'); ws=ws[(ws.HORIZONTAL_WIND_SPEED<1e6)&(ws.ROVER_STILL==1)]
    veri[sol]={'p':kutu(oku(sol,'PS'),'PRESSURE'),'T':kutu(oku(sol,'RHS'),'HUMIDITY_LOCAL_TEMP'),'v':kutu(ws,'HORIZONTAL_WIND_SPEED')}
EG,TE=(105,106,107),(109,110)
N={'p':4,'T':4,'v':1}; sonuc={}
for ad in 'pTv':
    htr=np.concatenate([veri[s][ad][0] for s in EG]); ytr=np.concatenate([veri[s][ad][1] for s in EG])
    hte=np.concatenate([veri[s][ad][0] for s in TE]); yte=np.concatenate([veri[s][ad][1] for s in TE])
    for n in (1,2,3,4):
        w,*_=np.linalg.lstsq(X(htr,n),ytr,rcond=None); pte=X(hte,n)@w
        print(f"{ad} n={n} eğitim {len(ytr)} test {len(yte)} RMSE test {np.sqrt(((yte-pte)**2).mean()):.2f} R² {r2(yte,pte):.3f} kapsam test {hte.min():.1f}-{hte.max():.1f} h")
        if n==N[ad]: sonuc[ad]={'n':n,'w':[round(x,4) for x in w],'rmse':round(float(np.sqrt(((yte-pte)**2).mean())),2),'r2':round(float(r2(yte,pte)),3)}
json.dump(sonuc,open('model2.json','w'),indent=1); print(json.dumps(sonuc))
