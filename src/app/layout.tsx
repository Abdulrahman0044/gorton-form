import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata:Metadata={
 title:"LMS Capacity Building Nomination | Gorton Consults Systems Ltd",
 description:"Nominate 16 staff for the LMS Capacity Building Programme. Save your nomination and continue later.",
 applicationName:"Gorton Nominations", manifest:"/manifest.webmanifest",
 icons:{
  icon:[
   {url:"/icons/icon-192.png",sizes:"192x192",type:"image/png"},
   {url:"/icons/icon-512.png",sizes:"512x512",type:"image/png"}
  ],
  apple:{url:"/icons/icon-192.png",sizes:"192x192",type:"image/png"}
 },
 appleWebApp:{capable:true,statusBarStyle:"default",title:"Gorton Nominations"}
};
export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:"#1c1827"};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body>{children}</body></html>;
}
