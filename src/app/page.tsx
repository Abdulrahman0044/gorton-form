import NominationWizard from "@/components/NominationWizard";
export default function Home(){
  return <><div className="top"><div className="wrap"><span><b>✉</b> info@gortonconsultssystems.com.ng</span><span className="hide"><b>◷</b> Mon–Sat: 8.00 am – 7.00 pm</span></div></div>
    <header className="nav"><div className="wrap"><a className="logo" href="https://gortonconsultssystems.com.ng/" aria-label="Gorton Consults Systems home">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="14" fill="none" stroke="#f5a623" strokeWidth="4"/><path d="M17 11a6 6 0 1 0 6 6h-6" fill="none" stroke="#f5a623" strokeWidth="3.2"/></svg>
      <span>GORTON<small>CONSULTS SYSTEMS LTD</small></span></a><nav><a href="https://gortonconsultssystems.com.ng/">Home</a><a href="https://gortonconsultssystems.com.ng/about/">About</a><a className="on" href="https://gortonconsultssystems.com.ng/services-3/">Services</a><a href="https://gortonconsultssystems.com.ng/contact/">Contact</a></nav>
      <div className="call"><span><small>Call Anytime</small>+234 (707) 6432 719</span></div></div></header>
    <section className="hero"><div className="wrap"><div className="eyebrow">Capacity Building</div><h1>LMS Capacity Building Nomination Form</h1>
      <p>Nominate 16 staff from your institution for the LMS Capacity Building Programme. It takes six short steps and your progress is saved on this device. Kindly note that this nomination is to be approved by the institution</p></div></section>
    <main className="wrap form-container"><NominationWizard/></main>
    <footer><div className="wrap"><div><h4>Gorton Consults Systems Ltd</h4><p>Experts in LMS training and management, capacity building and innovative tech solutions.</p></div>
      <div><h4>Contact</h4><p>+234 (0707) 6432 719</p><p>info@gortonconsultssystems.com.ng</p><p>Plot 1603, No: 7 Howeldy Street, Kado Estate, Kado District, FCT Abuja</p></div>
      <div><h4>Links</h4><p><a href="https://gortonconsultssystems.com.ng/about/">About</a></p><p><a href="https://gortonconsultssystems.com.ng/contact/">Contact</a></p><p><a href="/admin">Administrator</a></p></div>
      <div className="copy">© 2026 Gorton Consults Systems Ltd. All Rights Reserved.</div></div></footer></>;
}
