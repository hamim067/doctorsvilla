import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DoctorOS", template: "%s · DoctorOS" },
  description: "ডাক্তারের প্রোফাইল, সিরিয়াল, লাইভ ট্র্যাকিং ও ফলোআপ — এক জায়গায়",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Baloo+Da+2:wght@600;700;800&family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@700;800&display=swap" rel="stylesheet" />
        {/* লাইট/ডার্ক মোড — পেজ আঁকার আগেই কুকি থেকে, যেন সাদা ঝলক না দেখায় */}
        <script dangerouslySetInnerHTML={{ __html: `try{var m=document.cookie.match(/(?:^|; )dos_theme=(dark|light)/);if(m)document.documentElement.dataset.theme=m[1]}catch(e){}` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
