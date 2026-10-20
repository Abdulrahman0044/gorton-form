import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata:Metadata={
 title:"LMS Capacity Building Nomination | Gorton Consults Systems Ltd",
 description:"Nominate 16 staff for the LMS Capacity Building Programme. Save your nomination and continue later.",
 applicationName:"Gorton Nominations", manifest:"/manifest.webmanifest",
 appleWebApp:{capable:true,statusBarStyle:"default",title:"Gorton Nominations"}
};
export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:"#1c1827"};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body>{children}</body></html>;
}
