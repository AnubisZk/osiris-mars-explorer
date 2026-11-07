export const CONTROL_PROFILES=Object.freeze({
  soft:Object.freeze({stickExpo:.65,rightStickExpo:.85,throttleExpo:.9,angleLimit:20,angleYawRate:180,angleInputTime:.06,keyboardThrottleRate:.12}),
  sport:Object.freeze({stickExpo:0,rightStickExpo:0,throttleExpo:0,angleLimit:55,angleYawRate:null,angleInputTime:.018,keyboardThrottleRate:.34}),
});

export const controlProfile=name=>CONTROL_PROFILES[name]??CONTROL_PROFILES.soft;
// Expo preserves neutral, direction and full travel; it reduces gain near center.
export const expo=(value,amount)=>(1-amount)*value+amount*value**3;
