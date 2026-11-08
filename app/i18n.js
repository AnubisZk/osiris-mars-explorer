// UI strings: English first, Turkish option.
const S={
  en:{
    title:'OsirisZk · Mars Aerial Explorer',subtitle:'Mars rotorcraft design & mission simulator',
    tabEnv:'Mars environment',tabDesign:'Drone design lab',tabMission:'Mission',tabFlight:'Flight',tabTelemetry:'Telemetry',tabExperiments:'Experiments',tabReport:'Report',
    profile:'Planet profile',density:'Surface density',temperature:'Surface temperature',gravity:'Gravity',useProfile:'profile value',
    wind:'Wind',windDir:'Wind from (°)',dust:'Dust optical depth τ',date:'Mission date (UTC)',site:'Site',
    sun:'Sun',elevation:'elevation',azimuth:'azimuth',lst:'local solar time',delay:'Earth–Mars one-way light time',distance:'distance',
    params:'Parameters',status:'status',source:'source',apply:'Apply',
    vehicle:'Vehicle',frame:'Frame',payload:'Payload',calibration:'Rotor profile-loss model',calibrated:'calibrated to Ingenuity 350 W',uncalibrated:'uncalibrated section polar',
    mass:'Mass',com:'Centre of mass',inertia:'Principal inertia',canHover:'Can hover here',yes:'yes',no:'no',hoverPower:'Hover power (electrical, est.)',
    rpm:'Rotor speed setpoint',tipMach:'Tip Mach',reynolds:'Blade Re (75 % R)',twr:'Max thrust / weight',breakdown:'Mass breakdown',
    waypoints:'Waypoints',addWp:'Click the map to add an observation target',clearWp:'Clear',cruise:'Cruise altitude AGL',speed:'Cruise speed',reserve:'Energy reserve',
    control:'Control',autonomous:'Autonomous',earthFpv:'FPV from Earth (real light delay)',localFpv:'FPV on site (no delay, hypothetical)',
    budget:'Energy budget (pre-flight estimate)',route:'Route length',flightTime:'Flight time',energy:'Energy',available:'Available',margin:'Margin',feasible:'Feasible',
    launch:'Launch mission',abort:'Abort',reset:'Reset',land:'Land now',manual:'Manual',auto:'Autonomous',
    phase:'Phase',altitude:'Altitude AGL',vspeed:'Vertical speed',power:'Power',soc:'Battery',tilt:'Tilt',thrust:'Thrust',
    linkWait:'Your commands reach Mars in',linkInfo:'Real-time FPV is not possible from Earth: commands and video are delayed by the light time. The vehicle flies itself and lands if the link is stale.',
    result:'Result',success:'success',failed:'failed',observations:'Observations',export:'Export',
    expPreset:'Experiment',expRun:'Run experiment',expRunning:'Running',expVar:'Independent variable',expSeeds:'Seeds (repeats)',expResults:'Results',
    report:'Scientific report',download:'Download',perf:'Performance',bench:'Run 10 s benchmark',quality:'Render quality',
    procedural:'Procedural terrain — illustrative, NOT NASA data',keys:'W/S climb · arrows tilt · A/D yaw · C camera · L land',
    camera:'Camera',chase:'chase',fpv:'navigation camera',orbit:'orbit',
    assumed:'assumed',sourced:'sourced',brief:'brief value',derived:'derived',scenario:'scenario',
  },
  tr:{
    title:'OsirisZk · Mars Hava Kaşifi',subtitle:'Mars rotorlu araç tasarım ve görev simülatörü',
    tabEnv:'Mars ortamı',tabDesign:'Dron tasarım laboratuvarı',tabMission:'Görev',tabFlight:'Uçuş',tabTelemetry:'Telemetri',tabExperiments:'Deneyler',tabReport:'Rapor',
    profile:'Gezegen profili',density:'Yüzey yoğunluğu',temperature:'Yüzey sıcaklığı',gravity:'Yerçekimi',useProfile:'profil değeri',
    wind:'Rüzgâr',windDir:'Rüzgâr yönü (°, geldiği)',dust:'Toz optik derinliği τ',date:'Görev tarihi (UTC)',site:'Bölge',
    sun:'Güneş',elevation:'yükseklik',azimuth:'azimut',lst:'yerel güneş saati',delay:'Dünya–Mars tek yön ışık süresi',distance:'uzaklık',
    params:'Parametreler',status:'durum',source:'kaynak',apply:'Uygula',
    vehicle:'Araç',frame:'Gövde',payload:'Yük',calibration:'Rotor profil kaybı modeli',calibrated:'Ingenuity 350 W\'a kalibre',uncalibrated:'kalibrasyonsuz kesit poları',
    mass:'Kütle',com:'Kütle merkezi',inertia:'Asal atalet',canHover:'Burada askıda kalabilir',yes:'evet',no:'hayır',hoverPower:'Askı gücü (elektrik, tahmin)',
    rpm:'Rotor devir ayarı',tipMach:'Uç Mach',reynolds:'Pal Re (%75 R)',twr:'Azami itki / ağırlık',breakdown:'Kütle dağılımı',
    waypoints:'Ara noktalar',addWp:'Gözlem hedefi eklemek için haritaya tıkla',clearWp:'Temizle',cruise:'Seyir irtifası (yerden)',speed:'Seyir hızı',reserve:'Enerji yedeği',
    control:'Kontrol',autonomous:'Otonom',earthFpv:'Dünya\'dan FPV (gerçek ışık gecikmesi)',localFpv:'Yerinde FPV (gecikmesiz, varsayımsal)',
    budget:'Enerji bütçesi (uçuş öncesi tahmin)',route:'Güzergâh uzunluğu',flightTime:'Uçuş süresi',energy:'Enerji',available:'Kullanılabilir',margin:'Pay',feasible:'Uygulanabilir',
    launch:'Görevi başlat',abort:'Durdur',reset:'Sıfırla',land:'Hemen in',manual:'Manuel',auto:'Otonom',
    phase:'Evre',altitude:'İrtifa (yerden)',vspeed:'Dikey hız',power:'Güç',soc:'Batarya',tilt:'Eğim',thrust:'İtki',
    linkWait:'Komutların Mars\'a varış süresi',linkInfo:'Dünya\'dan gerçek zamanlı FPV mümkün değil: komut ve görüntü ışık süresi kadar gecikir. Araç kendi uçar, bağlantı eskirse iner.',
    result:'Sonuç',success:'başarılı',failed:'başarısız',observations:'Gözlemler',export:'Dışa aktar',
    expPreset:'Deney',expRun:'Deneyi çalıştır',expRunning:'Çalışıyor',expVar:'Bağımsız değişken',expSeeds:'Seed sayısı (tekrar)',expResults:'Sonuçlar',
    report:'Bilimsel rapor',download:'İndir',perf:'Performans',bench:'10 sn ölçüm',quality:'Çizim kalitesi',
    procedural:'Prosedürel arazi — temsilî, NASA verisi DEĞİL',keys:'W/S tırman · oklar eğim · A/D dönüş · C kamera · L in',
    camera:'Kamera',chase:'takip',fpv:'seyrüsefer kamerası',orbit:'yörünge',
    assumed:'varsayımsal',sourced:'kaynaklı',brief:'talimat değeri',derived:'türetilmiş',scenario:'senaryo',
  },
};
let lang='en';
try{lang=localStorage.getItem('osiris-lang')||'en';}catch{}
export const getLang=()=>lang;
export function setLang(l){lang=S[l]?l:'en';try{localStorage.setItem('osiris-lang',lang);}catch{}document.documentElement.lang=lang;}
export const t=k=>S[lang][k]??S.en[k]??k;
export const L=o=>o?.[lang]??o?.en??'';
