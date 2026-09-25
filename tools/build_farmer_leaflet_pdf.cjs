async function main() {
const fs = await import('node:fs');
const path = await import('node:path');
const { chromium } = await import('playwright');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'output', 'pdf');
const tmpDir = path.join(root, 'tmp', 'leaflet');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

function dataUri(file, mime) {
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

const logo = dataUri(path.join(root, 'public', 'brand', 'logo-icon.png'), 'image/png');
const photo = dataUri(path.join(root, 'public', 'images', 'about-farm.jpg'), 'image/jpeg');
const outputPdf = path.join(outDir, 'Ganpati_Agro_Farmer_Information_Leaflet.pdf');
const debugHtml = path.join(tmpDir, 'Ganpati_Agro_Farmer_Information_Leaflet.html');

const html = `<!doctype html>
<html lang="mr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ganpati Agro Farmer Information Leaflet</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #dfe5df; }
  body { font-family: "Nirmala UI", "Arial", sans-serif; color: #1C241E; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; height: 297mm; padding: 14mm 17mm 17mm; background: #fff; position: relative; overflow: hidden; break-after: page; }
  .page:last-child { break-after: auto; }
  .topline { height: 4mm; background: linear-gradient(90deg,#1F6B3A 0 72%,#D99A2B 72%); margin: -14mm -17mm 7mm; }
  .page-tag { font-size: 8pt; font-weight: 700; color: #1F6B3A; text-align: right; letter-spacing: .06em; margin-bottom: 2mm; }
  .eyebrow { font-size: 8.4pt; font-weight: 700; color: #1F6B3A; letter-spacing: .04em; text-transform: uppercase; margin: 0 0 2mm; }
  h1, h2, h3 { color: #000; margin: 0; line-height: 1.16; }
  h1 { font-size: 24pt; text-align: center; }
  h2 { font-size: 20pt; margin-bottom: 3.2mm; }
  h3 { font-size: 13.5pt; margin: 5mm 0 2mm; }
  .en { color: #667067; font-size: .56em; font-weight: 500; margin-left: 2mm; }
  p { font-size: 11pt; line-height: 1.48; margin: 0 0 3mm; }
  .lead { font-size: 11.7pt; line-height: 1.52; }
  .muted { color: #667067; }
  .center { text-align: center; }
  .green { color: #1F6B3A; }
  .gold { color: #7A5635; }
  .small { font-size: 8.8pt; }
  .footer { position: absolute; left: 17mm; right: 17mm; bottom: 6mm; padding-top: 2mm; border-top: .3mm solid #DDE2DA; font-size: 7.8pt; color: #667067; display: flex; justify-content: space-between; align-items: center; }
  .cover .topline { margin-bottom: 4mm; }
  .logo { width: 31mm; height: 31mm; object-fit: contain; display: block; margin: 0 auto 2mm; }
  .subtitle { text-align: center; margin: 2mm 0 5mm; font-size: 10.5pt; color: #667067; font-weight: 600; }
  .hero { width: 100%; height: 75mm; object-fit: cover; object-position: center 42%; border-radius: 3mm; display: block; }
  .cover-kicker { font-size: 17pt; color: #1F6B3A; font-weight: 700; text-align: center; margin: 5mm 0 1mm; }
  .tagline { text-align: center; color: #7A5635; font-size: 10.5pt; font-weight: 700; margin-bottom: 4mm; }
  .cover-intro { max-width: 165mm; margin: 0 auto 4mm; text-align: center; }
  .fee { width: 88mm; margin: 4mm auto 3mm; padding: 2.8mm 5mm; text-align: center; border-top: .7mm solid #D99A2B; border-bottom: .7mm solid #D99A2B; color: #123B24; font-size: 14.5pt; font-weight: 700; }
  .quote { margin-top: 5mm; text-align: center; color: #1F6B3A; font-weight: 700; font-style: italic; }
  .purpose-list { margin: 4mm 0 5mm; border-top: .3mm solid #D9D9D9; }
  .purpose-item { display: grid; grid-template-columns: 35mm 1fr; gap: 5mm; padding: 4.3mm 0; border-bottom: .3mm solid #D9D9D9; }
  .purpose-item strong { color: #123B24; font-size: 12.2pt; text-align: center; align-self: center; }
  .purpose-item p { margin: 0; font-size: 10.7pt; }
  ul.clean { margin: 2mm 0 0 6mm; padding-left: 5mm; }
  ul.clean li { font-size: 10.8pt; line-height: 1.4; margin-bottom: 2mm; padding-left: 1mm; }
  .cluster-grid { display: grid; grid-template-columns: repeat(3, 1fr); border-top: .3mm solid #D9D9D9; border-left: .3mm solid #D9D9D9; }
  .cluster-grid div { min-height: 14mm; display: flex; align-items: center; justify-content: center; text-align: center; padding: 2mm; border-right: .3mm solid #D9D9D9; border-bottom: .3mm solid #D9D9D9; font-size: 9pt; font-weight: 650; background: #FAFAF7; }
  .cluster-grid div:nth-child(even) { background: #EFF6F0; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: .3mm solid #D9D9D9; padding: 3.2mm; vertical-align: middle; }
  th { background: #123B24; color: white; font-size: 9.6pt; line-height: 1.3; text-align: center; }
  td { font-size: 9.8pt; line-height: 1.38; }
  tbody tr:nth-child(even) td { background: #EFF6F0; }
  td:first-child { color: #123B24; font-weight: 700; text-align: center; }
  .benefits th:nth-child(1), .benefits td:nth-child(1) { width: 25%; }
  .benefits th:nth-child(2), .benefits td:nth-child(2) { width: 39%; }
  .benefits th:nth-child(3), .benefits td:nth-child(3) { width: 36%; }
  .important { margin-top: 4mm; border-left: 1.1mm solid #D99A2B; padding: 1mm 0 1mm 4mm; font-size: 10.2pt; line-height: 1.45; }
  .steps th:nth-child(1), .steps td:nth-child(1) { width: 9%; }
  .steps th:nth-child(2), .steps td:nth-child(2) { width: 31%; }
  .steps th:nth-child(3), .steps td:nth-child(3) { width: 60%; }
  .steps td:nth-child(1) { color: #1F6B3A; font-size: 13pt; }
  .steps td:nth-child(2) { color: #1C241E; font-weight: 700; text-align: center; }
  .privacy { display: grid; grid-template-columns: 40mm 1fr; gap: 5mm; margin-top: 3mm; padding-top: 3mm; border-top: .5mm solid #D99A2B; }
  .privacy strong { color: #123B24; font-size: 12.5pt; text-align: center; align-self: center; }
  .privacy p { font-size: 10.4pt; margin: 0; }
  .contact td:first-child { width: 30%; background: #EFF6F0; }
  .contact tr:nth-child(even) td:first-child { background: #FFF6E5; }
  .contact td:nth-child(2) { font-size: 10.8pt; }
  .checklist { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5mm 6mm; margin-top: 2mm; }
  .check { font-size: 10pt; line-height: 1.35; padding-left: 7mm; position: relative; }
  .check::before { content: "□"; position: absolute; left: 0; top: -.5mm; color: #1F6B3A; font-size: 15pt; }
  .faq { margin-top: 1mm; }
  .faq p { font-size: 9.9pt; line-height: 1.36; margin-bottom: 2mm; }
  .faq strong { color: #1F6B3A; }
  .cta { text-align: center; margin-top: 4mm; padding-top: 3mm; border-top: .5mm solid #D99A2B; color: #123B24; font-size: 14.5pt; font-weight: 700; }
  .cta span { display: block; color: #7A5635; font-size: 9.8pt; margin-top: 1mm; }
  .contact-title .en { display: block; margin: 1mm 0 0; font-size: .5em; }
</style>
</head>
<body>

<section class="page cover">
  <div class="topline"></div>
  <img class="logo" src="${logo}" alt="Shri Ganpati Agro company logo">
  <h1>श्री गणपती ॲग्रो प्रोड्युसर कंपनी<br>शेतकरी माहिती पुस्तिका</h1>
  <div class="subtitle">Farmer Information Leaflet</div>
  <img class="hero" src="${photo}" alt="Farmers working in an agricultural field">
  <div class="cover-kicker">शेतकऱ्यांसाठी शेतकऱ्यांच्या सोबत</div>
  <div class="tagline">Growing Farmers&nbsp;&nbsp; Building Futures</div>
  <p class="cover-intro lead">गणपती ॲग्रो प्रोड्युसर कंपनी लिमिटेड ही २०१६ पासून बळीराजाच्या सेवेत असलेली शेतकरी केंद्रित कंपनी आहे. आम्ही शेतकऱ्यांना समूहांमध्ये जोडून उत्पादन खर्च कमी करणे, बाजारपेठेशी जोडणे आणि शेतमालाचे मूल्यवर्धन करणे यासाठी कार्यरत आहोत.</p>
  <div class="fee">एकदाच सभासदत्व शुल्क ₹500<br><span class="small muted">One time membership fee</span></div>
  <p class="center small muted">कंपनी अधिनियम २०१३ अंतर्गत नोंदणीकृत<br>CIN&nbsp; U01403MH2016PTC272505</p>
  <div class="footer"><span>श्री गणपती ॲग्रो प्रोड्युसर कंपनी लिमिटेड</span><span>+91 70300 39005</span><span>01</span></div>
</section>

<section class="page">
  <div class="topline"></div>
  <div class="page-tag">02 &nbsp; आमच्याबद्दल &nbsp; ABOUT US</div>
  <div class="eyebrow">आमचा उद्देश &nbsp; Our purpose</div>
  <h2>एकत्रित शेतीमधून मजबूत भविष्य <span class="en">A stronger future together</span></h2>
  <p class="lead">कंपनीचा भर शेतकऱ्यांना योग्य माहिती, समूहाची ताकद, तंत्रज्ञान सहाय्य, बाजार जोडणी आणि मूल्यवर्धनाच्या संधी उपलब्ध करून देण्यावर आहे.</p>
  <div class="purpose-list">
    <div class="purpose-item"><strong>व्हिजन<br><span class="small muted">Vision</span></strong><p>देशातील शेतकऱ्यांचे एकात्मिक साखळी समूह एकमेकांना जोडून शेतीचा विकास व मूल्यवर्धन करणे.</p></div>
    <div class="purpose-item"><strong>मिशन<br><span class="small muted">Mission</span></strong><p>शेतकऱ्यांचा उत्पादन खर्च कमी करणे, फायदेशीर बाजारपेठ उपलब्ध करून देणे आणि मूल्यवर्धन साखळीचा विकास व व्यवस्थापन करणे.</p></div>
    <div class="purpose-item"><strong>मूल्ये<br><span class="small muted">Values</span></strong><p>शेतकरी केंद्रित विचार, अखंडता, उत्कृष्टता, संघटित कार्य, उत्तरदायित्व आणि प्रामाणिक हेतू.</p></div>
  </div>
  <h3>आमच्या कामाचे मुख्य क्षेत्र <span class="en">What we work on</span></h3>
  <ul class="clean">
    <li>उत्पादन खर्च कमी करण्यासाठी बियाणे, खते, यंत्रसामग्री आणि तंत्रज्ञान सहाय्य.</li>
    <li>शेतमालासाठी फायदेशीर बाजारपेठ आणि खरेदीदारांशी जोडणी.</li>
    <li>प्रक्रिया, पॅकिंग आणि इतर मूल्यवर्धन संधींचा विकास.</li>
    <li>पीक आणि शेतीपूरक व्यवसायांनुसार शेतकरी समूहांमध्ये सहभाग.</li>
    <li>तज्ञ मार्गदर्शन आणि सामूहिक नियोजनाद्वारे शाश्वत प्रगती.</li>
  </ul>
  <h3>पीक आणि व्यवसाय समूह <span class="en">Crop and allied clusters</span></h3>
  <div class="cluster-grid">
    <div>तृणधान्ये<br>Cereals</div><div>कडधान्ये<br>Pulses</div><div>तेलबिया<br>Oilseeds</div>
    <div>फळे<br>Fruits</div><div>भाजीपाला<br>Vegetables</div><div>मसाला पिके<br>Spices</div>
    <div>फुले<br>Flowers</div><div>औषधी वनस्पती<br>Medicinal</div><div>संलग्न कृषी व्यवसाय<br>Allied</div>
    <div>संरक्षित शेती<br>Protected</div><div>कृषी वनीकरण<br>Agroforestry</div><div>मशरूम<br>Mushroom</div>
  </div>
  <p class="quote">योग्य आणि प्रामाणिक हेतूने शेतकऱ्यांसोबत काम करणे ही आमची बांधिलकी आहे</p>
  <div class="footer"><span>श्री गणपती ॲग्रो प्रोड्युसर कंपनी लिमिटेड</span><span>+91 70300 39005</span><span>02</span></div>
</section>

<section class="page">
  <div class="topline"></div>
  <div class="page-tag">03 &nbsp; सभासदत्व &nbsp; MEMBERSHIP</div>
  <div class="eyebrow">सभासद होण्याचे फायदे &nbsp; Membership benefits</div>
  <h2>₹500 मध्ये सक्रिय सभासदत्व <span class="en">Active membership after successful payment</span></h2>
  <p class="lead">नोंदणी फॉर्म पूर्ण करून ₹500 चे सुरक्षित ऑनलाइन पेमेंट यशस्वी झाल्यानंतर सभासदत्व सक्रिय होते. सभासद क्रमांक आणि पावती नोंदणीनंतर उपलब्ध होते.</p>
  <table class="benefits">
    <thead><tr><th>लाभ<br>Benefit</th><th>काय मिळते<br>What it includes</th><th>का उपयुक्त<br>Why it matters</th></tr></thead>
    <tbody>
      <tr><td>शेअर प्रमाणपत्र</td><td>कंपनीतील शेअर मालकी हक्क आणि नॉमिनी नोंदणी सुविधा</td><td>सभासदत्वाची औपचारिक आणि कायदेशीर नोंद</td></tr>
      <tr><td>कंपनी सभासदत्व</td><td>सर्वसाधारण सभेत मतदान आणि सभासद रजिस्टरमध्ये नोंद</td><td>कंपनीच्या सामूहिक निर्णय प्रक्रियेत सहभाग</td></tr>
      <tr><td>समूह सहभाग</td><td>तज्ञ मार्गदर्शन, तंत्रज्ञान सहाय्य आणि सामूहिक नियोजन</td><td>उत्पादन खर्च, गुणवत्ता आणि बाजार जोडणीत मदत</td></tr>
    </tbody>
  </table>
  <h3>सभासदांसाठी मुख्य संधी <span class="en">Member opportunities</span></h3>
  <ul class="clean">
    <li>बियाणे, खते, यंत्रसामग्री आणि शेती तंत्रज्ञानाबाबत सहाय्य.</li>
    <li>शेतमालाची बाजारपेठेशी जोडणी आणि मूल्यवर्धनासाठी सामूहिक प्रयत्न.</li>
    <li>पीक किंवा शेतीपूरक व्यवसायानुसार योग्य समूहात सहभागी होण्याची संधी.</li>
    <li>कंपनीच्या MOA AOA आणि लागू नियमांनुसार सभासद अधिकार.</li>
  </ul>
  <h3>रेफरल कोड <span class="en">Referral code</span></h3>
  <p>नोंदणी करताना रेफरल कोड देणे ऐच्छिक आहे. वैध कोड असल्यास तो पेमेंटपूर्वी भरा. पात्र रेफरल कमाई कंपनीच्या नोंदीत जमा होते आणि तिचे वितरण ऑफलाइन नोंदवले जाते.</p>
  <div class="important"><strong class="gold">महत्त्वाचे</strong>&nbsp; विशिष्ट लाभ, हस्तांतरण, लाभांश किंवा सेवा उपलब्धता कंपनीचे नियम, बोर्ड मान्यता आणि लागू कायद्यांनुसार ठरते.</div>
  <div class="footer"><span>श्री गणपती ॲग्रो प्रोड्युसर कंपनी लिमिटेड</span><span>+91 70300 39005</span><span>03</span></div>
</section>

<section class="page">
  <div class="topline"></div>
  <div class="page-tag">04 &nbsp; नोंदणी &nbsp; REGISTRATION</div>
  <div class="eyebrow">सुरक्षित डिजिटल नोंदणी &nbsp; Secure digital registration</div>
  <h2>नोंदणी करण्याची सोपी पद्धत <span class="en">Five simple steps</span></h2>
  <table class="steps">
    <thead><tr><th>टप्पा</th><th>कृती<br>Action</th><th>तपशील<br>Details</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>माहिती तयार ठेवा</td><td>पूर्ण नाव, 10 अंकी मोबाईल, जन्मतारीख, आधार, गाव तालुका जिल्हा आणि उत्पन्नाचे साधन.</td></tr>
      <tr><td>2</td><td>शेत माहिती भरा</td><td>गट किंवा सर्वे नंबर, क्षेत्रफळ, पिके, सिंचन स्रोत आणि योग्य समूह प्रकार.</td></tr>
      <tr><td>3</td><td>खाते तयार करा</td><td>किमान 8 अक्षरांचा पासवर्ड ठेवा. रेफरल कोड असल्यास भरा.</td></tr>
      <tr><td>4</td><td>संमती आणि पेमेंट</td><td>माहिती तपासा, संमती द्या आणि ₹500 चे सुरक्षित Razorpay पेमेंट पूर्ण करा.</td></tr>
      <tr><td>5</td><td>पावती जतन करा</td><td>पेमेंट पडताळल्यानंतर सभासदत्व सक्रिय होते. पावती प्रिंट करा किंवा PDF म्हणून जतन करा.</td></tr>
    </tbody>
  </table>
  <h3>पेमेंट सुरक्षिततेचे नियम <span class="en">Payment safety</span></h3>
  <ul class="clean">
    <li>खात्यातून रक्कम वजा झाली पण पावती मिळाली नाही तर पुन्हा पैसे भरू नका.</li>
    <li><strong>Check payment status</strong> वापरा किंवा कंपनीच्या अधिकृत क्रमांकावर संपर्क करा.</li>
    <li>अधिकृत कर्मचारी नोंदणीस मदत करू शकतो. रोख दिल्यास कर्मचारीच कंपनीला ₹500 ऑनलाइन भरतो आणि तुम्हाला पावती मिळणे आवश्यक आहे.</li>
    <li>पावतीची खाजगी लिंक सोशल मीडिया किंवा अनोळखी व्यक्तींना पाठवू नका.</li>
  </ul>
  <div class="privacy"><strong>तुमच्या माहितीची काळजी<br><span class="small muted">Your privacy</span></strong><p>तुमची माहिती नोंदणी, सभासदत्व आणि रेफरल सेवांसाठी वापरली जाते. आधार क्रमांक पावतीवर छापला जात नाही. फॉर्म भरताना आणि कागदपत्रे शेअर करताना फक्त अधिकृत माध्यम वापरा.</p></div>
  <div class="footer"><span>श्री गणपती ॲग्रो प्रोड्युसर कंपनी लिमिटेड</span><span>+91 70300 39005</span><span>04</span></div>
</section>

<section class="page">
  <div class="topline"></div>
  <div class="page-tag">05 &nbsp; संपर्क &nbsp; CONTACT</div>
  <div class="eyebrow">आजच संपर्क करा &nbsp; Get in touch</div>
  <h2 class="contact-title">सभासद होण्यासाठी आम्ही तुमच्या सोबत आहोत <span class="en">Membership support</span></h2>
  <p class="lead">नोंदणी लिंक, सभासदत्व, पेमेंट स्थिती किंवा पावतीबाबत मदत हवी असल्यास खालील अधिकृत संपर्क वापरा.</p>
  <table class="contact">
    <tbody>
      <tr><td>पत्ता<br>Address</td><td>बार्शी नाका, बार्शी रोड, धाराशिव, महाराष्ट्र 413501</td></tr>
      <tr><td>फोन<br>Phone</td><td><strong>+91 70300 39005 &nbsp; | &nbsp; +91 83903 35722</strong></td></tr>
      <tr><td>ईमेल<br>Email</td><td><strong>sganpatiagropcl@gmail.com</strong></td></tr>
      <tr><td>कंपनी क्रमांक<br>CIN</td><td>U01403MH2016PTC272505</td></tr>
    </tbody>
  </table>
  <h3>नोंदणीपूर्वीची तपासणी <span class="en">Before you register</span></h3>
  <div class="checklist">
    <div class="check">मोबाईल नंबर सक्रिय आहे</div>
    <div class="check">आधार क्रमांक जवळ आहे</div>
    <div class="check">गाव तालुका जिल्हा माहिती तयार आहे</div>
    <div class="check">सर्व प्लॉटची माहिती तयार आहे</div>
    <div class="check">सुरक्षित पासवर्ड ठरवला आहे</div>
    <div class="check">₹500 पेमेंट पद्धत उपलब्ध आहे</div>
  </div>
  <h3>वारंवार विचारले जाणारे प्रश्न <span class="en">Quick answers</span></h3>
  <div class="faq">
    <p><strong>सभासदत्व कधी सक्रिय होते</strong>&nbsp; ₹500 चे पेमेंट यशस्वीरीत्या पडताळल्यानंतर लगेच.</p>
    <p><strong>मी स्वतः नोंदणी करू शकतो का</strong>&nbsp; हो. तुम्ही स्वतः किंवा अधिकृत कर्मचाऱ्याच्या मदतीने नोंदणी करू शकता.</p>
    <p><strong>पेमेंट अडकले तर काय करावे</strong>&nbsp; पुन्हा पैसे भरू नका. पेमेंट स्थिती तपासा आणि कंपनीशी संपर्क करा.</p>
  </div>
  <div class="cta">सभासद व्हा आणि सामूहिक प्रगतीचा भाग बना<span>Join Ganpati Agro</span></div>
  <div class="footer"><span>श्री गणपती ॲग्रो प्रोड्युसर कंपनी लिमिटेड</span><span>+91 70300 39005</span><span>05</span></div>
</section>

</body>
</html>`;

fs.writeFileSync(debugHtml, html, 'utf8');

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE,
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1800 }, deviceScaleFactor: 1 });
  await page.goto(`file:///${debugHtml.replace(/\\/g, '/')}`, { waitUntil: 'load' });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: outputPdf,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await browser.close();
  console.log(outputPdf);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
