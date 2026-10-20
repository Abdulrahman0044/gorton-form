import type { MetadataRoute } from "next";
export default function manifest():MetadataRoute.Manifest {
 return {name:"Gorton Capacity Building Nominations",short_name:"Gorton Nomination",
  description:"Complete or resume a capacity-building nomination on your device.",start_url:"/",scope:"/",display:"standalone",
  background_color:"#f4f3f9",theme_color:"#1c1827",
  icons:[{src:"/icons/icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},{src:"/icons/icon-192.png",sizes:"192x192",type:"image/png",purpose:"maskable"},{src:"/icons/icon-512.png",sizes:"512x512",type:"image/png",purpose:"any"},{src:"/icons/icon-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"}]};
}
