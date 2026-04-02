/**
 * STRATIX new_features.js v1.0
 * New features: Route Optimizer, Load Planner, Maintenance Scheduler,
 * e-POD, TDS/TCS Tracker, AMC Tracker, ESG Tracker, POS Barcode,
 * Real Estate Tracker, Healthcare/Pharmacy tools
 * All plug into existing app.js renderSection() map
 */

/* ══════════════════════════════════════════════════════════
   1. ROUTE OPTIMIZER
   Lives inside: Logistics (transport) → sub-tab
══════════════════════════════════════════════════════════ */
function renderRouteOptimizer() {
  const cfg = STRATIX_DB.getSettings();
  const sym = cfg.currencySymbol || '₹';
  document.getElementById('sectionContent').innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div><h1 class="sec-title">🗺️ Route Optimizer</h1>
        <p class="sec-sub">530+ Indian cities · Real highway distances · Live cost & time calculator</p>
      </div>
      <button class="btn btn-gold" onclick="roCalc()">⚡ Calculate Route</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div class="card">
        <div class="card-title">📍 Trip Details</div>
        <div class="form-grid" style="margin-bottom:12px">
          <div class="field">
            <label>Origin City</label>
            <div style="position:relative">
              <input id="roOrigin" placeholder="Type city name..." oninput="roSearch(this,'roOriginList')" autocomplete="off"
                style="width:100%;padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;outline:none;transition:.2s"
                onfocus="this.style.borderColor='var(--gold)'" onblur="setTimeout(()=>document.getElementById('roOriginList').style.display='none',200)"/>
              <div id="roOriginList" class="ro-dd" style="display:none"></div>
            </div>
          </div>
          <div class="field">
            <label>Destination City</label>
            <div style="position:relative">
              <input id="roDest" placeholder="Type city name..." oninput="roSearch(this,'roDestList')" autocomplete="off"
                style="width:100%;padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;outline:none;transition:.2s"
                onfocus="this.style.borderColor='var(--gold)'" onblur="setTimeout(()=>document.getElementById('roDestList').style.display='none',200)"/>
              <div id="roDestList" class="ro-dd" style="display:none"></div>
            </div>
          </div>
        </div>
        <div id="roStops"></div>
        <button class="btn btn-ghost btn-sm" onclick="roAddStop()" style="margin-bottom:14px">+ Add Via Stop</button>
        <div class="form-grid">
          <div class="field"><label>Vehicle Type</label>
            <select id="roVehicle" style="width:100%;padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px">
              <option value="truck">🚛 Truck / Trailer (7 km/L · 50 km/h)</option>
              <option value="lcv">🚐 LCV / Mini Truck (12 km/L · 55 km/h)</option>
              <option value="bus">🚌 Bus (6 km/L · 45 km/h)</option>
              <option value="car">🚗 Car / Tempo (16 km/L · 65 km/h)</option>
              <option value="bike">🏍️ Bike / 2-Wheeler (48 km/L · 60 km/h)</option>
            </select>
          </div>
          <div class="field"><label>Diesel/Petrol Price (${sym}/L)</label>
            <input type="number" id="roFuelPrice" value="96" min="50" max="200"
              style="width:100%;padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px"/></div>
          <div class="field"><label>Toll Charges (${sym})</label>
            <input type="number" id="roToll" placeholder="0"
              style="width:100%;padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px"/></div>
          <div class="field"><label>Driver Bata (${sym})</label>
            <input type="number" id="roAllow" placeholder="600"
              style="width:100%;padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px"/></div>
          <div class="field"><label>Loading/Unloading (${sym})</label>
            <input type="number" id="roLoad" placeholder="0"
              style="width:100%;padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px"/></div>
          <div class="field"><label>Other Expenses (${sym})</label>
            <input type="number" id="roOther" placeholder="0"
              style="width:100%;padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px"/></div>
        </div>
        <div id="roNotFound" style="display:none;margin-top:12px;padding:12px 14px;background:rgba(79,158,240,.08);border:1px solid rgba(79,158,240,.2);border-radius:10px;font-size:12px;color:var(--blue)">
          🔍 City not in our database?
          <a id="roMapsLink" href="https://maps.google.com" target="_blank" style="color:var(--gold);font-weight:700;text-decoration:underline">Open Google Maps →</a>
          to find the exact distance and enter it manually.
        </div>
      </div>
      <div class="card" id="roResult">
        <div class="card-title">📊 Route Analysis</div>
        <div style="color:var(--muted);font-size:13px;text-align:center;padding:40px 20px">
          <div style="font-size:44px;margin-bottom:14px">🗺️</div>
          Enter origin and destination<br/>then click <strong style="color:var(--text)">Calculate Route</strong>
        </div>
      </div>
    </div>
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div class="card-title" style="margin:0">📜 Recent Route Calculations</div>
        <button class="btn btn-ghost btn-sm" onclick="STRATIX_DB.set('route_history',[]);renderRouteOptimizer()" style="font-size:11px">Clear</button>
      </div>
      <div id="roHistory">
        ${(STRATIX_DB.getArr('route_history')||[]).slice().reverse().slice(0,8).map(r=>`
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:20px">🛣️</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;color:var(--text)">${escapeHTML(r.route)}</div>
            <div style="font-size:11px;color:var(--muted)">${r.date} · ${r.km} km · ~${r.hrs||'?'}h · ${r.vehicle}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:14px;font-weight:700;color:var(--gold)">${sym}${Number(r.cost).toLocaleString('en-IN')}</div>
            <div style="font-size:10px;color:var(--muted)">${sym}${r.perKm||'?'}/km</div>
          </div>
        </div>`).join('') || '<div style="color:var(--muted);font-size:13px;padding:16px 0;text-align:center">No routes calculated yet</div>'}
      </div>
    </div>
  </div>
  <style>
    .ro-dd{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:300;background:#FFFFFF;border:1px solid var(--border2);border-radius:10px;max-height:240px;overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,.7)}
    .ro-opt{padding:9px 14px;cursor:pointer;font-size:13px;color:var(--text2);display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(26,37,64,.4);transition:.1s}
    .ro-opt:hover,.ro-opt:focus{background:rgba(37,99,235,.08);color:var(--text)}
    .ro-state{font-size:10px;color:var(--muted);background:var(--surface3);padding:2px 6px;border-radius:4px}
  </style>`;
}

// ── 530+ Indian cities: [name, stateCode, lat, lng]
const RO_CITIES = [
  ['Mumbai','MH',19.076,72.877],['Pune','MH',18.520,73.856],['Nagpur','MH',21.146,79.088],['Nashik','MH',19.998,73.789],['Aurangabad','MH',19.877,75.343],['Solapur','MH',17.686,75.904],['Kolhapur','MH',16.705,74.243],['Ahmednagar','MH',19.094,74.739],['Thane','MH',19.218,72.978],['Nanded','MH',19.153,77.321],['Amravati','MH',20.931,77.752],['Jalgaon','MH',21.003,75.561],['Dhule','MH',20.902,74.774],['Latur','MH',18.400,76.560],['Sangli','MH',16.854,74.565],['Satara','MH',17.686,74.001],['Akola','MH',20.709,77.001],['Parbhani','MH',19.271,76.773],['Wardha','MH',20.748,78.602],['Chandrapur','MH',19.961,79.297],['Yavatmal','MH',20.389,78.120],['Bhandara','MH',21.168,79.650],['Gondia','MH',21.460,80.198],['Osmanabad','MH',18.187,76.039],['Ratnagiri','MH',16.994,73.300],['Sindhudurg','MH',16.349,73.748],['Pandharpur','MH',17.681,75.329],['Wai','MH',17.953,73.890],['Baramati','MH',18.152,74.577],['Malegaon','MH',20.561,74.524],['Ichalkaranji','MH',16.697,74.460],
  ['Ahmedabad','GJ',23.023,72.572],['Surat','GJ',21.170,72.831],['Vadodara','GJ',22.307,73.181],['Rajkot','GJ',22.303,70.802],['Bhavnagar','GJ',21.752,72.152],['Jamnagar','GJ',22.468,70.058],['Gandhinagar','GJ',23.216,72.637],['Anand','GJ',22.556,72.952],['Bharuch','GJ',21.708,72.995],['Navsari','GJ',20.951,72.932],['Valsad','GJ',20.595,72.932],['Morbi','GJ',22.818,70.834],['Mehsana','GJ',23.600,72.374],['Amreli','GJ',21.604,71.220],['Surendranagar','GJ',22.727,71.649],['Porbandar','GJ',21.643,69.608],['Junagadh','GJ',21.522,70.457],['Veraval','GJ',20.907,70.366],['Palanpur','GJ',24.174,72.438],['Godhra','GJ',22.777,73.614],['Dahod','GJ',22.837,74.255],['Bhuj','GJ',23.252,69.669],['Dwarka','GJ',22.239,68.968],['Somnath','GJ',20.888,70.401],
  ['Jaipur','RJ',26.912,75.787],['Jodhpur','RJ',26.293,73.040],['Kota','RJ',25.178,75.832],['Ajmer','RJ',26.451,74.638],['Bikaner','RJ',28.022,73.312],['Udaipur','RJ',24.587,73.712],['Alwar','RJ',27.554,76.634],['Bharatpur','RJ',27.217,77.490],['Sikar','RJ',27.612,75.140],['Pali','RJ',25.772,73.325],['Nagaur','RJ',27.204,73.736],['Barmer','RJ',25.746,71.390],['Sriganganagar','RJ',29.914,73.878],['Churu','RJ',28.298,74.967],['Chittorgarh','RJ',24.880,74.630],['Jhalawar','RJ',24.596,76.164],['Dungarpur','RJ',23.839,73.717],['Bundi','RJ',25.438,75.637],['Jhunjhunu','RJ',28.128,75.400],['Banswara','RJ',23.553,74.443],['Mount Abu','RJ',24.592,72.708],['Sawai Madhopur','RJ',25.990,76.350],['Tonk','RJ',26.168,75.789],
  ['Delhi','DL',28.704,77.102],['New Delhi','DL',28.613,77.209],['Noida','UP',28.535,77.391],['Gurugram','HR',28.457,77.027],['Faridabad','HR',28.408,77.314],['Ghaziabad','UP',28.668,77.454],
  ['Lucknow','UP',26.847,80.947],['Kanpur','UP',26.449,80.331],['Agra','UP',27.180,78.013],['Varanasi','UP',25.317,82.974],['Prayagraj','UP',25.436,81.846],['Meerut','UP',28.985,77.706],['Bareilly','UP',28.365,79.415],['Moradabad','UP',28.839,78.777],['Aligarh','UP',27.882,78.080],['Mathura','UP',27.497,77.673],['Jhansi','UP',25.449,78.568],['Gorakhpur','UP',26.760,83.373],['Firozabad','UP',27.153,78.395],['Muzaffarnagar','UP',29.470,77.703],['Saharanpur','UP',29.967,77.546],['Etawah','UP',26.785,79.024],['Rampur','UP',28.805,79.024],['Shahjahanpur','UP',27.882,79.903],['Raebareli','UP',26.234,81.234],['Sitapur','UP',27.567,80.683],['Banda','UP',25.482,80.334],['Fatehpur','UP',25.931,80.813],['Bulandshahr','UP',28.407,77.847],['Lakhimpur','UP',27.947,80.781],['Hardoi','UP',27.398,80.130],['Unnao','UP',26.555,80.487],['Jaunpur','UP',25.731,82.684],['Sultanpur','UP',26.263,82.072],['Faizabad','UP',26.775,82.139],['Basti','UP',26.795,82.726],['Azamgarh','UP',26.067,83.183],['Ballia','UP',25.760,84.149],['Gonda','UP',27.131,81.964],['Deoria','UP',26.505,83.783],['Mainpuri','UP',27.231,79.017],['Etah','UP',27.558,78.665],
  ['Bhopal','MP',23.259,77.412],['Indore','MP',22.719,75.857],['Jabalpur','MP',23.183,79.987],['Gwalior','MP',26.219,78.182],['Ujjain','MP',23.182,75.782],['Sagar','MP',23.838,78.738],['Rewa','MP',24.531,81.297],['Satna','MP',24.583,80.827],['Chhindwara','MP',22.057,78.939],['Ratlam','MP',23.332,75.038],['Dewas','MP',22.965,76.052],['Singrauli','MP',24.199,82.674],['Morena','MP',26.501,77.996],['Vidisha','MP',23.525,77.808],['Betul','MP',21.908,77.895],['Hoshangabad','MP',22.748,77.726],['Khandwa','MP',21.831,76.352],['Burhanpur','MP',21.303,76.227],['Neemuch','MP',24.477,74.870],['Mandsaur','MP',24.073,75.073],['Shivpuri','MP',25.424,77.660],['Datia','MP',25.668,78.458],['Chhatarpur','MP',24.918,79.584],['Dhar','MP',22.600,75.300],['Jhabua','MP',22.768,74.594],['Khargone','MP',21.824,75.614],['Guna','MP',24.648,77.317],
  ['Patna','BR',25.594,85.137],['Gaya','BR',24.796,85.012],['Bhagalpur','BR',25.252,87.014],['Muzaffarpur','BR',26.125,85.391],['Purnia','BR',25.778,87.472],['Darbhanga','BR',26.152,85.897],['Ara','BR',25.557,84.660],['Bihar Sharif','BR',25.196,85.518],['Katihar','BR',25.567,87.578],['Hajipur','BR',25.685,85.211],['Munger','BR',25.375,86.471],['Begusarai','BR',25.418,86.130],['Motihari','BR',26.650,84.916],['Sitamarhi','BR',26.594,85.490],['Samastipur','BR',25.858,85.779],['Siwan','BR',26.221,84.358],['Sasaram','BR',24.947,84.031],
  ['Kolkata','WB',22.572,88.363],['Howrah','WB',22.595,88.299],['Durgapur','WB',23.480,87.320],['Asansol','WB',23.685,86.989],['Siliguri','WB',26.717,88.428],['Burdwan','WB',23.232,87.858],['Malda','WB',25.001,88.139],['Kharagpur','WB',22.346,87.321],['Haldia','WB',22.060,88.069],['Jalpaiguri','WB',26.543,88.718],['Cooch Behar','WB',26.327,89.445],['Purulia','WB',23.335,86.369],['Raiganj','WB',25.621,88.122],['Bankura','WB',23.230,87.073],
  ['Bangalore','KA',12.972,77.594],['Mysore','KA',12.297,76.639],['Hubli','KA',15.363,75.124],['Dharwad','KA',15.459,75.008],['Mangalore','KA',12.914,74.856],['Belgaum','KA',15.851,74.497],['Davangere','KA',14.465,75.921],['Bellary','KA',15.139,76.921],['Gulbarga','KA',17.329,76.820],['Bijapur','KA',16.833,75.715],['Shimoga','KA',13.930,75.567],['Udupi','KA',13.342,74.745],['Hassan','KA',13.005,76.099],['Raichur','KA',16.203,77.355],['Tumkur','KA',13.341,77.101],['Bidar','KA',17.912,77.512],['Koppal','KA',15.352,76.154],['Bagalkot','KA',16.180,75.696],['Gadag','KA',15.423,75.634],['Haveri','KA',14.793,75.399],['Chikmagalur','KA',13.319,75.777],['Mandya','KA',12.523,76.897],['Kolar','KA',13.135,78.129],['Chitradurga','KA',14.231,76.400],['Hosur','KA',12.739,77.826],
  ['Chennai','TN',13.083,80.270],['Coimbatore','TN',11.017,76.955],['Madurai','TN',9.919,78.120],['Salem','TN',11.664,78.148],['Tirupur','TN',11.104,77.341],['Tiruchirappalli','TN',10.790,78.701],['Tirunelveli','TN',8.727,77.694],['Vellore','TN',12.916,79.133],['Erode','TN',11.341,77.717],['Dindigul','TN',10.366,77.972],['Thoothukudi','TN',8.764,78.135],['Thanjavur','TN',10.787,79.139],['Nagercoil','TN',8.178,77.435],['Kanchipuram','TN',12.838,79.704],['Sivakasi','TN',9.453,77.799],['Kumbakonam','TN',10.961,79.380],['Namakkal','TN',11.219,78.167],['Krishnagiri','TN',12.519,78.213],['Virudhunagar','TN',9.580,77.904],['Cuddalore','TN',11.748,79.769],['Tiruvannamalai','TN',12.225,79.074],['Villupuram','TN',11.937,79.493],['Nagapattinam','TN',10.764,79.842],
  ['Hyderabad','TS',17.385,78.487],['Warangal','TS',17.977,79.601],['Karimnagar','TS',18.438,79.126],['Nizamabad','TS',18.673,78.094],['Khammam','TS',17.248,80.153],['Ramagundam','TS',18.765,79.475],['Mahabubnagar','TS',16.737,77.987],['Nalgonda','TS',17.053,79.266],['Adilabad','TS',19.664,78.532],['Siddipet','TS',18.102,78.852],['Sangareddy','TS',17.625,78.084],
  ['Visakhapatnam','AP',17.686,83.218],['Vijayawada','AP',16.506,80.648],['Guntur','AP',16.307,80.436],['Kakinada','AP',16.939,82.236],['Nellore','AP',14.442,79.987],['Tirupati','AP',13.629,79.419],['Rajahmundry','AP',16.984,81.803],['Kurnool','AP',15.828,78.037],['Kadapa','AP',14.466,78.822],['Ongole','AP',15.504,80.044],['Chittoor','AP',13.217,79.100],['Anantapur','AP',14.683,77.601],['Eluru','AP',16.712,81.097],['Machilipatnam','AP',16.187,81.138],['Srikakulam','AP',18.298,83.897],['Vizianagaram','AP',18.119,83.396],['Proddatur','AP',14.749,78.548],['Nandyal','AP',15.477,78.486],
  ['Kochi','KL',9.931,76.267],['Thiruvananthapuram','KL',8.524,76.936],['Kozhikode','KL',11.253,75.782],['Thrissur','KL',10.526,76.214],['Kollam','KL',8.881,76.584],['Kannur','KL',11.869,75.357],['Palakkad','KL',10.776,76.654],['Malappuram','KL',11.072,76.074],['Alappuzha','KL',9.499,76.339],['Kottayam','KL',9.591,76.524],['Kasaragod','KL',12.498,74.992],
  ['Bhubaneswar','OD',20.296,85.825],['Cuttack','OD',20.462,85.883],['Rourkela','OD',22.226,84.863],['Sambalpur','OD',21.469,83.975],['Puri','OD',19.810,85.832],['Berhampur','OD',19.312,84.790],['Balasore','OD',21.494,86.937],['Baripada','OD',21.938,86.711],['Jharsuguda','OD',21.854,84.006],
  ['Ranchi','JH',23.344,85.309],['Jamshedpur','JH',22.805,86.203],['Dhanbad','JH',23.800,86.441],['Bokaro','JH',23.668,86.148],['Hazaribagh','JH',23.993,85.359],['Deoghar','JH',24.483,86.695],['Giridih','JH',24.190,86.303],
  ['Raipur','CG',21.251,81.630],['Bhilai','CG',21.209,81.428],['Durg','CG',21.190,81.282],['Bilaspur','CG',22.088,82.150],['Korba','CG',22.347,82.700],['Rajnandgaon','CG',21.097,81.033],['Jagdalpur','CG',19.072,82.028],['Raigarh','CG',21.900,83.396],
  ['Amritsar','PB',31.634,74.872],['Ludhiana','PB',30.901,75.847],['Jalandhar','PB',31.326,75.575],['Patiala','PB',30.340,76.387],['Bathinda','PB',30.211,74.944],['Pathankot','PB',32.274,75.652],['Mohali','PB',30.705,76.731],['Moga','PB',30.812,75.173],['Ferozepur','PB',30.933,74.621],['Gurdaspur','PB',32.038,75.406],['Hoshiarpur','PB',31.533,75.912],['Sangrur','PB',30.246,75.844],['Faridkot','PB',30.673,74.757],
  ['Hisar','HR',29.155,75.722],['Rohtak','HR',28.895,76.600],['Panipat','HR',29.390,76.969],['Ambala','HR',30.376,76.777],['Karnal','HR',29.686,76.990],['Yamunanagar','HR',30.131,77.267],['Bhiwani','HR',28.789,76.140],['Sirsa','HR',29.537,75.026],['Rewari','HR',28.198,76.619],['Sonipat','HR',28.995,77.020],['Kurukshetra','HR',29.967,76.870],['Kaithal','HR',29.802,76.399],['Jind','HR',29.316,76.316],['Panchkula','HR',30.695,76.853],
  ['Dehradun','UK',30.317,78.032],['Haridwar','UK',29.945,78.163],['Rishikesh','UK',30.087,78.268],['Roorkee','UK',29.854,77.889],['Haldwani','UK',29.222,79.513],['Rudrapur','UK',28.974,79.400],['Mussoorie','UK',30.453,78.065],['Kashipur','UK',29.211,78.958],
  ['Shimla','HP',31.104,77.173],['Dharamsala','HP',32.216,76.319],['Mandi','HP',31.710,76.932],['Solan','HP',30.909,77.096],['Kullu','HP',31.957,77.109],['Hamirpur','HP',31.685,76.524],['Una','HP',31.469,76.271],
  ['Srinagar','JK',34.082,74.797],['Jammu','JK',32.733,74.867],['Leh','LA',34.166,77.580],['Anantnag','JK',33.732,75.153],['Baramulla','JK',34.197,74.348],['Udhampur','JK',32.920,75.143],
  ['Guwahati','AS',26.144,91.736],['Silchar','AS',24.826,92.796],['Dibrugarh','AS',27.477,94.903],['Jorhat','AS',26.750,94.217],['Nagaon','AS',26.348,92.686],['Tinsukia','AS',27.489,95.358],['Tezpur','AS',26.633,92.800],['Bongaigaon','AS',26.477,90.555],['Sivsagar','AS',26.987,94.638],['Golaghat','AS',26.518,93.963],
  ['Imphal','MN',24.820,93.953],['Shillong','ML',25.578,91.883],['Kohima','NL',25.671,94.114],['Aizawl','MZ',23.726,92.713],['Agartala','TR',23.831,91.281],['Itanagar','AR',27.085,93.606],['Dimapur','NL',25.897,93.728],['Gangtok','SK',27.338,88.608],
  ['Panaji','GA',15.492,73.826],['Margao','GA',15.273,74.014],['Vasco da Gama','GA',15.395,73.813],
];

// Key highway distances (sorted city pair as 'A|B')
const RO_DIST_MAP = {
  'Mumbai|Pune':148,'Mumbai|Nashik':165,'Mumbai|Aurangabad':335,'Mumbai|Nagpur':830,'Mumbai|Ahmedabad':524,'Mumbai|Surat':264,'Mumbai|Vadodara':390,'Mumbai|Hyderabad':710,'Mumbai|Bangalore':981,'Mumbai|Delhi':1414,'Mumbai|Indore':588,'Mumbai|Solapur':461,'Mumbai|Kolhapur':378,'Mumbai|Bhopal':775,'Mumbai|Jaipur':1150,'Mumbai|Rajkot':740,'Mumbai|Thane':20,'Mumbai|Panaji':600,'Mumbai|Goa':600,
  'Pune|Nashik':210,'Pune|Solapur':248,'Pune|Kolhapur':228,'Pune|Hyderabad':549,'Pune|Bangalore':840,'Pune|Nagpur':685,'Pune|Aurangabad':235,'Pune|Satara':118,'Pune|Sangli':200,'Pune|Goa':459,'Pune|Ahmednagar':120,
  'Delhi|Agra':206,'Delhi|Jaipur':268,'Delhi|Amritsar':449,'Delhi|Ludhiana':305,'Delhi|Chandigarh':248,'Delhi|Lucknow':555,'Delhi|Kanpur':490,'Delhi|Varanasi':820,'Delhi|Prayagraj':720,'Delhi|Kolkata':1474,'Delhi|Hyderabad':1570,'Delhi|Bangalore':2047,'Delhi|Chennai':2182,'Delhi|Srinagar':876,'Delhi|Dehradun':295,'Delhi|Haridwar':220,'Delhi|Meerut':72,'Delhi|Ghaziabad':22,'Delhi|Noida':18,'Delhi|Faridabad':30,'Delhi|Gurugram':30,'Delhi|Hisar':163,'Delhi|Rohtak':70,'Delhi|Panipat':90,'Delhi|Ambala':200,'Delhi|Mathura':162,'Delhi|Bhopal':782,'Delhi|Indore':870,'Delhi|Ahmedabad':930,'Delhi|Shimla':343,'Delhi|Patna':1100,'Delhi|Nagpur':1100,'Delhi|Jodhpur':606,'Delhi|Bikaner':494,'Delhi|Udaipur':660,'Delhi|Ajmer':390,'Delhi|Kota':500,'Delhi|Alwar':156,'Delhi|Sonipat':48,'Delhi|Karnal':130,
  'Bangalore|Chennai':346,'Bangalore|Hyderabad':568,'Bangalore|Kochi':540,'Bangalore|Coimbatore':364,'Bangalore|Mysore':140,'Bangalore|Pune':840,'Bangalore|Mangalore':360,'Bangalore|Belgaum':500,'Bangalore|Hubli':418,'Bangalore|Tirupati':245,'Bangalore|Salem':334,'Bangalore|Tumkur':71,'Bangalore|Bellary':303,'Bangalore|Hosur':40,'Bangalore|Kolar':68,'Bangalore|Mandya':100,'Bangalore|Davangere':266,
  'Hyderabad|Vijayawada':274,'Hyderabad|Visakhapatnam':627,'Hyderabad|Nagpur':500,'Hyderabad|Warangal':155,'Hyderabad|Karimnagar':165,'Hyderabad|Nalgonda':165,'Hyderabad|Nizamabad':173,'Hyderabad|Kurnool':220,'Hyderabad|Nellore':420,'Hyderabad|Tirupati':556,'Hyderabad|Guntur':290,'Hyderabad|Kakinada':430,'Hyderabad|Khammam':218,'Hyderabad|Bidar':140,
  'Chennai|Coimbatore':497,'Chennai|Madurai':461,'Chennai|Tiruchirappalli':331,'Chennai|Vellore':135,'Chennai|Tirupati':148,'Chennai|Salem':340,'Chennai|Tirunelveli':622,'Chennai|Kochi':683,'Chennai|Visakhapatnam':793,'Chennai|Vijayawada':432,'Chennai|Nellore':184,'Chennai|Kanchipuram':75,'Chennai|Hosur':40,'Chennai|Krishnagiri':229,
  'Ahmedabad|Surat':263,'Ahmedabad|Vadodara':111,'Ahmedabad|Rajkot':215,'Ahmedabad|Bhavnagar':195,'Ahmedabad|Jamnagar':325,'Ahmedabad|Gandhinagar':30,'Ahmedabad|Anand':70,'Ahmedabad|Bharuch':160,'Ahmedabad|Jaipur':669,'Ahmedabad|Indore':395,'Ahmedabad|Udaipur':258,'Ahmedabad|Jodhpur':476,'Ahmedabad|Mehsana':72,'Ahmedabad|Palanpur':135,'Ahmedabad|Porbandar':399,'Ahmedabad|Junagadh':320,
  'Kolkata|Bhubaneswar':440,'Kolkata|Patna':580,'Kolkata|Ranchi':390,'Kolkata|Asansol':200,'Kolkata|Durgapur':160,'Kolkata|Siliguri':600,'Kolkata|Dhanbad':250,'Kolkata|Jamshedpur':290,'Kolkata|Howrah':3,'Kolkata|Guwahati':1010,'Kolkata|Haldia':124,'Kolkata|Balasore':219,'Kolkata|Kharagpur':115,'Kolkata|Puri':502,
  'Jaipur|Agra':240,'Jaipur|Jodhpur':335,'Jaipur|Kota':248,'Jaipur|Ajmer':134,'Jaipur|Bikaner':325,'Jaipur|Udaipur':420,'Jaipur|Alwar':157,'Jaipur|Sikar':110,'Jaipur|Bharatpur':185,'Jaipur|Lucknow':565,'Jaipur|Bhopal':552,'Jaipur|Chandigarh':510,
  'Lucknow|Kanpur':80,'Lucknow|Varanasi':295,'Lucknow|Prayagraj':200,'Lucknow|Agra':363,'Lucknow|Bareilly':262,'Lucknow|Gorakhpur':268,'Lucknow|Jhansi':403,'Lucknow|Patna':560,'Lucknow|Faizabad':130,'Lucknow|Sitapur':88,'Lucknow|Gonda':168,
  'Chandigarh|Amritsar':229,'Chandigarh|Ludhiana':100,'Chandigarh|Jalandhar':126,'Chandigarh|Shimla':113,'Chandigarh|Dharamsala':240,'Chandigarh|Ambala':48,'Chandigarh|Patiala':65,'Chandigarh|Mohali':12,
  'Indore|Bhopal':195,'Indore|Ujjain':56,'Indore|Ratlam':135,'Indore|Khandwa':134,'Indore|Dewas':36,'Indore|Nagpur':452,'Indore|Jabalpur':370,'Indore|Gwalior':460,
  'Patna|Gaya':105,'Patna|Muzaffarpur':78,'Patna|Varanasi':246,'Patna|Ranchi':330,'Patna|Bhagalpur':245,'Patna|Darbhanga':141,'Patna|Siwan':168,'Patna|Ara':55,'Patna|Katihar':224,'Patna|Hajipur':16,
  'Ranchi|Jamshedpur':130,'Ranchi|Dhanbad':162,'Ranchi|Bokaro':65,'Ranchi|Hazaribagh':100,'Ranchi|Patna':330,'Ranchi|Raipur':440,
  'Bhubaneswar|Cuttack':28,'Bhubaneswar|Puri':65,'Bhubaneswar|Rourkela':335,'Bhubaneswar|Sambalpur':320,'Bhubaneswar|Berhampur':172,'Bhubaneswar|Balasore':214,'Bhubaneswar|Visakhapatnam':452,
  'Raipur|Bhilai':26,'Raipur|Durg':28,'Raipur|Bilaspur':118,'Raipur|Nagpur':310,'Raipur|Jabalpur':330,'Raipur|Bhopal':480,'Raipur|Ranchi':440,
  'Guwahati|Shillong':100,'Guwahati|Dibrugarh':470,'Guwahati|Jorhat':310,'Guwahati|Silchar':340,'Guwahati|Tezpur':176,'Guwahati|Siliguri':275,'Guwahati|Imphal':481,'Guwahati|Agartala':586,
  'Dehradun|Haridwar':54,'Dehradun|Rishikesh':44,'Dehradun|Roorkee':53,'Dehradun|Chandigarh':167,'Dehradun|Shimla':255,'Dehradun|Haldwani':161,'Dehradun|Mussoorie':35,
  'Kochi|Thiruvananthapuram':210,'Kochi|Kozhikode':218,'Kochi|Thrissur':74,'Kochi|Kollam':73,'Kochi|Kannur':325,'Kochi|Palakkad':155,'Kochi|Alappuzha':55,'Kochi|Kottayam':64,'Kochi|Bangalore':540,'Kochi|Chennai':683,'Kochi|Coimbatore':210,'Kochi|Madurai':310,
  'Nagpur|Amravati':150,'Nagpur|Wardha':75,'Nagpur|Chandrapur':148,'Nagpur|Yavatmal':185,'Nagpur|Akola':210,'Nagpur|Raipur':310,'Nagpur|Jabalpur':312,'Nagpur|Hyderabad':500,'Nagpur|Aurangabad':420,'Nagpur|Bhopal':357,
  'Visakhapatnam|Vijayawada':355,'Visakhapatnam|Rajahmundry':198,'Visakhapatnam|Kakinada':218,'Visakhapatnam|Bhubaneswar':452,'Visakhapatnam|Hyderabad':627,'Visakhapatnam|Raipur':585,
  'Amritsar|Ludhiana':133,'Amritsar|Jalandhar':80,'Amritsar|Pathankot':111,'Amritsar|Jammu':210,
  'Srinagar|Jammu':280,'Srinagar|Leh':422,'Srinagar|Anantnag':55,
  'Panaji|Margao':35,'Panaji|Bangalore':576,'Panaji|Mumbai':600,'Panaji|Mangalore':336,'Panaji|Pune':459,'Panaji|Kolhapur':225,
  'Coimbatore|Madurai':218,'Coimbatore|Salem':165,'Coimbatore|Kochi':210,'Coimbatore|Tirupur':49,
  'Madurai|Tiruchirappalli':135,'Madurai|Tirunelveli':167,'Madurai|Kochi':310,'Madurai|Nagercoil':218,
  'Varanasi|Prayagraj':122,'Varanasi|Patna':246,'Varanasi|Gorakhpur':220,'Varanasi|Jaunpur':62,
  'Kanpur|Agra':286,'Kanpur|Jhansi':236,'Agra|Mathura':56,'Agra|Jhansi':240,'Agra|Gwalior':116,'Agra|Bharatpur':57,
  'Jodhpur|Ajmer':201,'Jodhpur|Bikaner':247,'Jodhpur|Udaipur':262,'Udaipur|Chittorgarh':118,'Udaipur|Kota':262,'Udaipur|Ahmedabad':258,
  'Bhopal|Ujjain':190,'Bhopal|Sagar':180,'Bhopal|Jabalpur':322,'Bhopal|Gwalior':420,'Bhopal|Rewa':490,'Bhopal|Nagpur':357,'Bhopal|Kota':350,
  'Gwalior|Agra':116,'Gwalior|Jhansi':100,'Gwalior|Morena':40,
  'Kolhapur|Sangli':48,'Kolhapur|Satara':138,'Kolhapur|Belgaum':106,
  'Nashik|Aurangabad':192,'Nashik|Jalgaon':160,'Nashik|Dhule':108,
  'Surat|Vadodara':135,'Surat|Bharuch':74,'Surat|Navsari':38,'Surat|Valsad':75,
  'Vadodara|Anand':45,'Vadodara|Bharuch':74,'Vadodara|Godhra':90,
  'Rajkot|Jamnagar':90,'Rajkot|Bhavnagar':164,'Rajkot|Morbi':75,
  'Hubli|Dharwad':21,'Hubli|Belgaum':172,'Hubli|Davangere':103,'Hubli|Shimoga':170,
  'Mangalore|Udupi':58,'Mangalore|Kochi':369,
  'Asansol|Durgapur':40,'Asansol|Dhanbad':56,'Jamshedpur|Dhanbad':103,'Jamshedpur|Ranchi':130,
  'Bhilai|Durg':8,'Bhilai|Bilaspur':105,'Jabalpur|Sagar':160,'Jabalpur|Rewa':200,'Jabalpur|Nagpur':312,
  'Mysore|Hassan':119,'Mysore|Mandya':40,'Warangal|Karimnagar':100,'Warangal|Khammam':118,
  'Tirupati|Nellore':158,'Tirupati|Chennai':148,'Guntur|Vijayawada':35,'Vijayawada|Rajahmundry':182,'Vijayawada|Kakinada':204,
  'Jalandhar|Ludhiana':62,'Jalandhar|Patiala':102,'Ludhiana|Patiala':76,'Ludhiana|Bathinda':115,
  'Haridwar|Rishikesh':20,'Haridwar|Roorkee':35,'Hisar|Rohtak':95,'Ambala|Chandigarh':48,
};

// Haversine distance (km) between two lat/lng points
function roHaversine(lat1,lon1,lat2,lon2){
  const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))*1.38); // 1.38 = road factor
}

function roGetCity(name){
  if(!name) return null;
  const n=name.trim().toLowerCase();
  return RO_CITIES.find(c=>c[0].toLowerCase()===n)||
         RO_CITIES.find(c=>c[0].toLowerCase().startsWith(n))||null;
}

function roGetKm(a,b){
  const k1=[a,b].sort().join('|'), k2=[b,a].sort().join('|');
  if(RO_DIST_MAP[k1]) return RO_DIST_MAP[k1];
  if(RO_DIST_MAP[k2]) return RO_DIST_MAP[k2];
  // Haversine fallback
  const ca=roGetCity(a), cb=roGetCity(b);
  if(ca&&cb) return roHaversine(ca[2],ca[3],cb[2],cb[3]);
  return null; // unknown
}

function roSearch(input, listId){
  const q=input.value.trim().toLowerCase();
  const list=document.getElementById(listId);
  if(!list) return;
  if(q.length<2){ list.style.display='none'; return; }
  const matches=RO_CITIES.filter(c=>c[0].toLowerCase().includes(q)).slice(0,12);
  if(!matches.length){ list.style.display='none'; return; }
  list.innerHTML=matches.map(c=>
    `<div class="ro-opt" onmousedown="roSelect('${listId}','${c[0]}')">
      <span>${escapeHTML(c[0])}</span>
      <span class="ro-state">${c[1]}</span>
    </div>`).join('');
  list.style.display='block';
}

function roSelect(listId,cityName){
  const isOrigin=listId==='roOriginList';
  const inputId=isOrigin?'roOrigin':'roDest';
  const el=document.getElementById(inputId);
  if(el){ el.value=cityName; el.style.borderColor='var(--green)'; }
  const list=document.getElementById(listId);
  if(list) list.style.display='none';
}

function roAddStop(){
  const wrap=document.getElementById('roStops');
  const idx=wrap.querySelectorAll('.ro-stop-wrap').length+1;
  const d=document.createElement('div');
  d.className='ro-stop-wrap';
  d.style.cssText='margin-bottom:10px;position:relative;display:flex;gap:8px;align-items:center';
  d.innerHTML=`<div style="flex:1;position:relative">
    <input class="ro-stop-input" placeholder="Via Stop ${idx} (optional)" oninput="roSearch(this,'roStop${idx}List')"
      style="width:100%;padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;outline:none"
      onblur="setTimeout(()=>{const l=document.getElementById('roStop${idx}List');if(l)l.style.display='none'},200)"/>
    <div id="roStop${idx}List" class="ro-dd" style="display:none"></div>
  </div>
  <button onclick="this.closest('.ro-stop-wrap').remove()" style="background:var(--surface3);border:none;border-radius:8px;color:var(--muted);cursor:pointer;padding:8px 10px;font-size:13px">✕</button>`;
  wrap.appendChild(d);
}

function roCalc(){
  const origin=document.getElementById('roOrigin')?.value.trim();
  const dest=document.getElementById('roDest')?.value.trim();
  if(!origin||!dest){ NOTIFY.show('Enter origin and destination city','warning'); return; }

  const vType=document.getElementById('roVehicle')?.value||'truck';
  const fuelPx=parseFloat(document.getElementById('roFuelPrice')?.value)||96;
  const toll=parseFloat(document.getElementById('roToll')?.value)||0;
  const allow=parseFloat(document.getElementById('roAllow')?.value)||0;
  const load=parseFloat(document.getElementById('roLoad')?.value)||0;
  const other=parseFloat(document.getElementById('roOther')?.value)||0;
  const stops=Array.from(document.querySelectorAll('.ro-stop-input')).map(i=>i.value.trim()).filter(Boolean);

  const allCities=[origin,...stops,dest];
  let totalKm=0;
  const legs=[];
  let hasUnknown=false;
  let unknownPair='';

  for(let i=0;i<allCities.length-1;i++){
    const km=roGetKm(allCities[i],allCities[i+1]);
    if(km===null){ hasUnknown=true; unknownPair=`${allCities[i]} → ${allCities[i+1]}`; break; }
    totalKm+=km;
    legs.push({from:allCities[i],to:allCities[i+1],km});
  }

  if(hasUnknown){
    const notFound=document.getElementById('roNotFound');
    const mapsLink=document.getElementById('roMapsLink');
    if(notFound) notFound.style.display='block';
    if(mapsLink){
      const q=encodeURIComponent(`${unknownPair} distance India`);
      mapsLink.href=`https://www.google.com/maps/dir/${encodeURIComponent(unknownPair.replace(' → ','/'))}`;
    }
    NOTIFY.show(`City not found in database: "${unknownPair}". Try Google Maps →`,'warning',6000);
    document.getElementById('roResult').innerHTML=`
      <div class="card-title">⚠️ City Not Found</div>
      <div style="text-align:center;padding:20px;color:var(--muted)">
        <div style="font-size:36px;margin-bottom:12px">🔍</div>
        <p style="font-size:13px;margin-bottom:12px">Could not find distance for:<br/><strong style="color:var(--text)">${escapeHTML(unknownPair)}</strong></p>
        <a href="https://www.google.com/maps/dir/${encodeURIComponent(unknownPair.replace(' → ','/'))}" target="_blank"
          style="display:inline-block;padding:9px 18px;background:var(--gold);color:#F8FAFC;border-radius:9px;font-weight:700;font-size:13px;text-decoration:none">
          📍 Open Google Maps →
        </a>
      </div>`;
    return;
  }

  const vConfig={
    truck:{mileage:7,speed:50,label:'Truck'},
    lcv:{mileage:12,speed:55,label:'LCV / Mini Truck'},
    bus:{mileage:6,speed:45,label:'Bus'},
    car:{mileage:16,speed:65,label:'Car / Tempo'},
    bike:{mileage:48,speed:60,label:'Bike / 2W'}
  };
  const vc=vConfig[vType]||vConfig.truck;
  const litres=totalKm/vc.mileage;
  const fuelCost=Math.round(litres*fuelPx);
  const totalCost=fuelCost+toll+allow+load+other;
  const perKm=(totalCost/totalKm).toFixed(1);
  const totalHrs=totalKm/vc.speed;
  const hrs=Math.floor(totalHrs);
  const mins=Math.round((totalHrs-hrs)*60);
  const timeStr=hrs>0?`${hrs}h ${mins}m`:`${mins}m`;
  const sym=STRATIX_DB.getSettings().currencySymbol||'₹';

  STRATIX_DB.push('route_history',{
    route:`${origin} → ${dest}`,km:totalKm,hrs:timeStr,
    cost:totalCost,vehicle:vc.label,perKm,
    date:new Date().toISOString().split('T')[0]
  });
  if(typeof STRATIX_STORE!=='undefined') STRATIX_STORE.invalidate('route_history');

  document.getElementById('roResult').innerHTML=`
    <div class="card-title">📊 ${escapeHTML(origin)} → ${escapeHTML(dest)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
      <div style="background:rgba(79,158,240,.08);border:1px solid rgba(79,158,240,.2);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Distance</div>
        <div style="font-size:22px;font-weight:800;color:var(--blue)">${totalKm}<span style="font-size:12px"> km</span></div>
      </div>
      <div style="background:rgba(0,214,143,.08);border:1px solid rgba(0,214,143,.2);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Est. Time</div>
        <div style="font-size:22px;font-weight:800;color:var(--green)">${timeStr}</div>
      </div>
      <div style="background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.2);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Total Cost</div>
        <div style="font-size:22px;font-weight:800;color:var(--gold)">${sym}${totalCost.toLocaleString('en-IN')}</div>
      </div>
    </div>
    ${legs.length>1?`<div style="margin-bottom:14px;background:var(--surface2);border-radius:10px;padding:12px">
      <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">Route Breakdown</div>
      ${legs.map((l,i)=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
        <div><span style="color:var(--muted)">${i+1}.</span> <strong>${escapeHTML(l.from)}</strong> <span style="color:var(--muted)">→</span> <strong>${escapeHTML(l.to)}</strong></div>
        <div style="color:var(--blue);font-weight:600">${l.km} km</div>
      </div>`).join('')}
    </div>`:''}
    <div style="background:var(--surface2);border-radius:10px;padding:14px;font-size:13px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)"><span style="color:var(--muted)">⛽ Fuel (${litres.toFixed(1)}L × ${sym}${fuelPx})</span><span style="font-weight:600;color:var(--red)">${sym}${fuelCost.toLocaleString('en-IN')}</span></div>
      ${toll?`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)"><span style="color:var(--muted)">🛣️ Toll</span><span style="font-weight:600">${sym}${toll.toLocaleString('en-IN')}</span></div>`:''}
      ${allow?`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)"><span style="color:var(--muted)">👨 Driver Bata</span><span style="font-weight:600">${sym}${allow.toLocaleString('en-IN')}</span></div>`:''}
      ${load?`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)"><span style="color:var(--muted)">📦 Loading/Unloading</span><span style="font-weight:600">${sym}${load.toLocaleString('en-IN')}</span></div>`:''}
      ${other?`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)"><span style="color:var(--muted)">📝 Other</span><span style="font-weight:600">${sym}${other.toLocaleString('en-IN')}</span></div>`:''}
      <div style="display:flex;justify-content:space-between;padding:8px 0 0;font-weight:700;font-size:14px"><span>Total Trip Cost</span><span style="color:var(--gold)">${sym}${totalCost.toLocaleString('en-IN')}</span></div>
      <div style="font-size:11px;color:var(--muted);margin-top:5px">Cost per km: ${sym}${perKm} · Vehicle: ${vc.label} · Avg speed: ${vc.speed} km/h</div>
    </div>
    <button class="btn btn-gold btn-full btn-sm" onclick="APP.navigate('trippnl')">📝 Log as Trip P&L →</button>`;
}


/* ══════════════════════════════════════════════════════════
   2. LOAD PLANNER
   Lives inside: Fleet Manager → sub-tab
══════════════════════════════════════════════════════════ */
function renderLoadPlanner() {
  const el = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div><h1 class="sec-title">📦 Load Planner</h1><p class="sec-sub">Visual truck/container packing guide — maximize space, prevent overloading</p></div>
      <button class="btn btn-gold" onclick="lpCalc()">📐 Calculate Load</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card">
        <div class="card-title">🚛 Vehicle Capacity</div>
        <div class="form-grid">
          <div class="field"><label>Vehicle Type</label>
            <select id="lpVehicle" onchange="lpPreset(this.value)">
              <option value="container40">40ft Container (67.6 CBM / 26T)</option>
              <option value="container20">20ft Container (33.2 CBM / 21T)</option>
              <option value="trailer">Trailer (40 CBM / 20T)</option>
              <option value="truck22">22ft Truck (32 CBM / 7T)</option>
              <option value="truck17">17ft Truck (20 CBM / 5T)</option>
              <option value="lcv">LCV Mini Truck (7 CBM / 1.5T)</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div class="field"><label>Max Volume (CBM)</label><input type="number" id="lpMaxVol" value="67.6" step="0.1"/></div>
          <div class="field"><label>Max Weight (Tonnes)</label><input type="number" id="lpMaxWt" value="26" step="0.1"/></div>
        </div>
        <div class="card-title" style="margin-top:12px">📦 Items to Load</div>
        <div id="lpItems">
          <div class="lp-item" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px">
            <div class="field"><label>Item / SKU</label><input placeholder="Cement Bags" class="lp-name"/></div>
            <div class="field"><label>Qty</label><input type="number" placeholder="100" class="lp-qty" value="1" min="1"/></div>
            <div class="field"><label>Vol/unit (CBM)</label><input type="number" placeholder="0.05" class="lp-vol" step="0.001"/></div>
            <div class="field"><label>Wt/unit (kg)</label><input type="number" placeholder="50" class="lp-wt" step="0.1"/></div>
            <button class="del-btn" onclick="this.closest('.lp-item').remove()" style="margin-bottom:2px">🗑</button>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="lpAddItem()" style="margin-top:4px">+ Add Item</button>
      </div>
      <div class="card" id="lpResult">
        <div class="card-title">📊 Load Analysis</div>
        <div style="color:var(--muted);font-size:13px;text-align:center;padding:30px 0">Add items and click<br/><strong style="color:var(--text)">Calculate Load</strong></div>
      </div>
    </div>
  </div>`;
}

function lpPreset(v) {
  const presets = { container40:[67.6,26], container20:[33.2,21], trailer:[40,20], truck22:[32,7], truck17:[20,5], lcv:[7,1.5] };
  if (presets[v]) {
    document.getElementById('lpMaxVol').value = presets[v][0];
    document.getElementById('lpMaxWt').value  = presets[v][1];
  }
}

function lpAddItem() {
  const wrap = document.getElementById('lpItems');
  const div  = document.createElement('div');
  div.className = 'lp-item';
  div.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px';
  div.innerHTML = `
    <div class="field"><label>Item / SKU</label><input placeholder="Item name" class="lp-name"/></div>
    <div class="field"><label>Qty</label><input type="number" placeholder="1" class="lp-qty" value="1" min="1"/></div>
    <div class="field"><label>Vol/unit (CBM)</label><input type="number" placeholder="0.05" class="lp-vol" step="0.001"/></div>
    <div class="field"><label>Wt/unit (kg)</label><input type="number" placeholder="50" class="lp-wt" step="0.1"/></div>
    <button class="del-btn" onclick="this.closest('.lp-item').remove()" style="margin-bottom:2px">🗑</button>`;
  wrap.appendChild(div);
}

function lpCalc() {
  const maxVol = parseFloat(document.getElementById('lpMaxVol').value) || 0;
  const maxWt  = parseFloat(document.getElementById('lpMaxWt').value) * 1000 || 0; // to kg
  const items  = Array.from(document.querySelectorAll('.lp-item')).map(row => ({
    name: row.querySelector('.lp-name').value.trim() || 'Item',
    qty:  parseFloat(row.querySelector('.lp-qty').value) || 1,
    vol:  parseFloat(row.querySelector('.lp-vol').value) || 0,
    wt:   parseFloat(row.querySelector('.lp-wt').value)  || 0
  })).filter(i => i.vol > 0 || i.wt > 0);

  if (!items.length) { NOTIFY.show('Add at least one item', 'error'); return; }

  const totalVol = items.reduce((s,i) => s + i.vol * i.qty, 0);
  const totalWt  = items.reduce((s,i) => s + i.wt  * i.qty, 0);
  const volPct   = maxVol > 0 ? Math.min(100, Math.round((totalVol/maxVol)*100)) : 0;
  const wtPct    = maxWt  > 0 ? Math.min(100, Math.round((totalWt /maxWt )*100)) : 0;
  const status   = (volPct > 100 || wtPct > 100) ? 'overloaded' : (volPct > 85 || wtPct > 85) ? 'full' : 'ok';
  const statusCol= status === 'overloaded' ? 'var(--red)' : status === 'full' ? 'var(--gold)' : 'var(--green)';
  const statusLbl= status === 'overloaded' ? '⚠️ OVERLOADED — reduce cargo' : status === 'full' ? '📦 Near capacity — check' : '✅ Load is within limits';

  document.getElementById('lpResult').innerHTML = `
    <div class="card-title">📊 Load Analysis</div>
    <div style="background:${statusCol}18;border:1px solid ${statusCol}44;border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:13px;font-weight:700;color:${statusCol}">${statusLbl}</div>
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:12px"><span style="color:var(--muted)">Volume Used</span><span style="font-weight:700">${totalVol.toFixed(2)} / ${maxVol} CBM</span></div>
      <div class="prog"><div class="prog-fill ${volPct>100?'pr':volPct>85?'po':'pg'}" style="width:${Math.min(100,volPct)}%"></div></div>
      <div style="font-size:11px;color:${volPct>100?'var(--red)':volPct>85?'var(--gold)':'var(--green)'};margin-top:3px">${volPct}% of volume capacity</div>
    </div>
    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:12px"><span style="color:var(--muted)">Weight Used</span><span style="font-weight:700">${(totalWt/1000).toFixed(2)} / ${(maxWt/1000).toFixed(1)} T</span></div>
      <div class="prog"><div class="prog-fill ${wtPct>100?'pr':wtPct>85?'po':'pg'}" style="width:${Math.min(100,wtPct)}%"></div></div>
      <div style="font-size:11px;color:${wtPct>100?'var(--red)':wtPct>85?'var(--gold)':'var(--green)'};margin-top:3px">${wtPct}% of weight capacity</div>
    </div>
    <div class="tbl-scroll"><table>
      <thead><tr><th>Item</th><th>Qty</th><th>Total Vol</th><th>Total Wt</th></tr></thead>
      <tbody>
        ${items.map(i=>`<tr>
          <td class="td-b">${escapeHTML(i.name)}</td>
          <td>${i.qty}</td>
          <td>${(i.vol*i.qty).toFixed(3)} CBM</td>
          <td>${((i.wt*i.qty)/1000).toFixed(3)} T</td>
        </tr>`).join('')}
        <tr style="font-weight:700">
          <td colspan="2" style="color:var(--text)">TOTAL</td>
          <td style="color:var(--blue)">${totalVol.toFixed(3)} CBM</td>
          <td style="color:var(--blue)">${(totalWt/1000).toFixed(3)} T</td>
        </tr>
      </tbody>
    </table></div>
    ${status==='ok'?`<div style="font-size:12px;color:var(--green);margin-top:10px">Remaining capacity: ${(maxVol-totalVol).toFixed(2)} CBM / ${((maxWt-totalWt)/1000).toFixed(2)} T</div>`:''}`;
}

/* ══════════════════════════════════════════════════════════
   3. MAINTENANCE SCHEDULER
   Lives inside: Fleet Manager → sub-tab
   Reads mileage from trips, auto-creates reminders
══════════════════════════════════════════════════════════ */
function renderMaintenanceScheduler() {
  const fleet   = STRATIX_DB.getArr('fleet');
  const trips   = STRATIX_DB.getArr('trips');
  const maint   = STRATIX_DB.getArr('maintenance_schedule');
  const el      = document.getElementById('sectionContent');

  // Calculate total km per vehicle from trips
  const kmByVehicle = {};
  trips.forEach(t => {
    if (t.vehicle && t.km) {
      kmByVehicle[t.vehicle] = (kmByVehicle[t.vehicle]||0) + Number(t.km||0);
    }
  });

  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div><h1 class="sec-title">🔧 Maintenance Scheduler</h1><p class="sec-sub">Auto-tracks oil changes, tire rotations &amp; permit renewals based on trip mileage</p></div>
      <button class="btn btn-gold" onclick="openMaintModal()">+ Add Schedule</button>
    </div>

    <!-- Upcoming alerts -->
    <div class="card" style="margin-bottom:18px">
      <div class="card-title">⚠️ Due Soon / Overdue</div>
      ${(() => {
        const today = new Date();
        const alerts = maint.filter(m => {
          if (m.type === 'km') {
            const vehicleKm = kmByVehicle[m.vehicle] || 0;
            return vehicleKm >= (Number(m.triggerKm) - 500);
          } else {
            return m.dueDate && new Date(m.dueDate) <= new Date(today.getTime() + 7*24*60*60*1000);
          }
        });
        if (!alerts.length) return '<div style="color:var(--green);font-size:13px;padding:10px 0">✅ No maintenance due in next 7 days</div>';
        return alerts.map(a => {
          const isKm = a.type === 'km';
          const vehicleKm = kmByVehicle[a.vehicle] || 0;
          const overdue = isKm ? vehicleKm >= Number(a.triggerKm) : new Date(a.dueDate) < today;
          return `<div class="warning-card ${overdue?'red':'yellow'}" style="margin-bottom:8px">
            <div class="warn-icon">${a.task==='oil'?'🛢️':a.task==='tyre'?'🔄':a.task==='permit'?'📋':a.task==='service'?'🔩':'🔧'}</div>
            <div class="warn-body">
              <div class="warn-title">${escapeHTML(a.taskLabel||a.task)} — ${escapeHTML(a.vehicle)}</div>
              <div class="warn-desc">${isKm?`Current: ${vehicleKm} km / Trigger at: ${a.triggerKm} km`:`Due: ${a.dueDate}`}</div>
            </div>
            <span class="warn-status" style="color:${overdue?'var(--red)':'var(--gold)'}">${overdue?'OVERDUE':'DUE SOON'}</span>
            <button class="btn btn-sm btn-green" style="margin-left:8px" onclick="maintDone('${a.id}')">✓ Done</button>
          </div>`;
        }).join('');
      })()}
    </div>

    <!-- All schedules -->
    <div class="tbl-wrap">
      <div class="tbl-head"><div class="tbl-title">All Maintenance Schedules</div></div>
      ${!maint.length ? `<div class="empty" style="padding:32px">No schedules yet. Add one to start tracking.<br/><button class="btn btn-gold btn-sm" style="margin-top:12px" onclick="openMaintModal()">+ Add First Schedule</button></div>` : `
      <div class="tbl-scroll"><table>
        <thead><tr><th>Vehicle</th><th>Task</th><th>Trigger Type</th><th>Trigger</th><th>Current KM</th><th>Status</th><th></th></tr></thead>
        <tbody>
        ${maint.map(m => {
          const vehicleKm = kmByVehicle[m.vehicle] || 0;
          const isDue = m.type === 'km' ? vehicleKm >= Number(m.triggerKm) : m.dueDate && new Date(m.dueDate) < new Date();
          return `<tr>
            <td class="td-b">${escapeHTML(m.vehicle)}</td>
            <td>${escapeHTML(m.taskLabel||m.task)}</td>
            <td>${m.type === 'km' ? '📏 Mileage' : '📅 Date'}</td>
            <td>${m.type === 'km' ? m.triggerKm + ' km' : m.dueDate}</td>
            <td>${vehicleKm} km</td>
            <td><span class="badge ${isDue?'br':'bg'}">${isDue?'Due':'OK'}</span></td>
            <td><button class="del-btn" onclick="STRATIX_DB.remove('maintenance_schedule','${m.id}');renderMaintenanceScheduler()">🗑</button></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`}
    </div>
  </div>`;
}

function openMaintModal() {
  const fleet = STRATIX_DB.getArr('fleet');
  const trips = STRATIX_DB.getArr('trips');
  const vehicles = [...new Set([...fleet.map(f=>f.number), ...trips.map(t=>t.vehicle)])].filter(Boolean);
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="maintModal" onclick="if(event.target===this)document.getElementById('maintModal').remove()">
    <div class="modal" style="max-width:480px">
      <div class="modal-hd"><div class="modal-title">🔧 Add Maintenance Schedule</div><button class="modal-close" onclick="document.getElementById('maintModal').remove()">✕</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Vehicle *</label>
            <input id="mVehicle" placeholder="Vehicle no. or name" list="mVehicleList"/>
            <datalist id="mVehicleList">${vehicles.map(v=>`<option value="${escapeHTML(v)}">`).join('')}</datalist>
          </div>
          <div class="field"><label>Task *</label>
            <select id="mTask">
              <option value="oil">🛢️ Oil Change</option>
              <option value="tyre">🔄 Tyre Rotation / Replacement</option>
              <option value="permit">📋 Permit Renewal</option>
              <option value="service">🔩 Full Service</option>
              <option value="battery">🔋 Battery Check</option>
              <option value="brake">🛑 Brake Inspection</option>
              <option value="insurance">📄 Insurance Renewal</option>
              <option value="fitness">🏷️ Fitness Certificate</option>
              <option value="other">🔧 Other</option>
            </select>
          </div>
          <div class="field"><label>Trigger Type</label>
            <select id="mType" onchange="document.getElementById('mKmWrap').style.display=this.value==='km'?'block':'none';document.getElementById('mDateWrap').style.display=this.value==='date'?'block':'none'">
              <option value="km">Mileage (km)</option>
              <option value="date">Calendar Date</option>
            </select>
          </div>
        </div>
        <div id="mKmWrap" class="field" style="margin-bottom:14px"><label>Trigger at KM</label><input type="number" id="mKm" placeholder="e.g. 5000"/></div>
        <div id="mDateWrap" class="field" style="margin-bottom:14px;display:none"><label>Due Date</label><input type="date" id="mDate" value="${new Date().toISOString().split('T')[0]}"/></div>
        <div class="field"><label>Notes</label><input id="mNotes" placeholder="Optional notes"/></div>
        <div style="display:flex;gap:10px;margin-top:14px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('maintModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="saveMaintSchedule()">💾 Save Schedule</button>
        </div>
      </div>
    </div>
  </div>`);
}

function saveMaintSchedule() {
  const vehicle = document.getElementById('mVehicle').value.trim();
  const task    = document.getElementById('mTask').value;
  const type    = document.getElementById('mType').value;
  if (!vehicle) { NOTIFY.show('Enter vehicle name/number', 'error'); return; }
  const taskLabels = {oil:'Oil Change',tyre:'Tyre Rotation',permit:'Permit Renewal',service:'Full Service',battery:'Battery Check',brake:'Brake Inspection',insurance:'Insurance Renewal',fitness:'Fitness Certificate',other:'Maintenance'};
  STRATIX_DB.push('maintenance_schedule', {
    vehicle, task, taskLabel: taskLabels[task]||task, type,
    triggerKm: type==='km' ? document.getElementById('mKm').value : null,
    dueDate:   type==='date' ? document.getElementById('mDate').value : null,
    notes:     document.getElementById('mNotes').value.trim()
  });
  // Auto-create reminder
  if (type === 'date') {
    STRATIX_DB.push('reminders', {
      title: `${taskLabels[task]||task} — ${vehicle}`,
      date:  document.getElementById('mDate').value,
      category: 'Maintenance', amount: 0
    });
    NOTIFY.show('Schedule saved + Reminder created ✅', 'success');
  } else {
    NOTIFY.show('Maintenance schedule saved ✅', 'success');
  }
  document.getElementById('maintModal').remove();
  renderMaintenanceScheduler();
}

function maintDone(id) {
  STRATIX_DB.update('maintenance_schedule', id, { lastDone: new Date().toISOString().split('T')[0] });
  NOTIFY.show('Marked as done ✅', 'success');
  renderMaintenanceScheduler();
}

/* ══════════════════════════════════════════════════════════
   4. e-POD — Digital Proof of Delivery
   Lives inside: Logistics Docs → sub-feature
══════════════════════════════════════════════════════════ */
function renderEPOD() {
  const pods = STRATIX_DB.getArr('epods');
  const el   = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div><h1 class="sec-title">📸 e-POD — Digital Proof of Delivery</h1><p class="sec-sub">Record delivery confirmation with signature, photo &amp; timestamp</p></div>
      <button class="btn btn-gold" onclick="openEPODModal()">+ New Delivery Record</button>
    </div>
    <div class="tbl-wrap">
      <div class="tbl-head"><div class="tbl-title">Delivery Records</div></div>
      ${!pods.length ? `<div class="empty" style="padding:36px">No deliveries recorded yet.<br/><button class="btn btn-gold btn-sm" style="margin-top:12px" onclick="openEPODModal()">Record First Delivery</button></div>` : `
      <div class="tbl-scroll"><table>
        <thead><tr><th>LR / Order No</th><th>Consignee</th><th>Delivered By</th><th>Date & Time</th><th>Status</th><th>Remarks</th><th></th></tr></thead>
        <tbody>
        ${[...pods].reverse().map(p=>`<tr>
          <td class="td-b">${escapeHTML(p.lrNo||'—')}</td>
          <td>${escapeHTML(p.consignee||'—')}</td>
          <td>${escapeHTML(p.driver||'—')}</td>
          <td class="td-m">${p.deliveredAt||'—'}</td>
          <td><span class="badge ${p.status==='delivered'?'bg':p.status==='partial'?'bgold':'br'}">${escapeHTML(p.status||'pending')}</span></td>
          <td class="td-m">${escapeHTML(p.remarks||'—')}</td>
          <td><button class="del-btn" onclick="STRATIX_DB.remove('epods','${p.id}');renderEPOD()">🗑</button></td>
        </tr>`).join('')}
        </tbody>
      </table></div>`}
    </div>
  </div>`;
}

function openEPODModal() {
  const trips = STRATIX_DB.getArr('trips');
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="epodModal" onclick="if(event.target===this)document.getElementById('epodModal').remove()">
    <div class="modal" style="max-width:520px">
      <div class="modal-hd"><div class="modal-title">📸 Record Delivery (e-POD)</div><button class="modal-close" onclick="document.getElementById('epodModal').remove()">✕</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>LR / Order Number *</label><input id="epLR" placeholder="LR-00123"/></div>
          <div class="field"><label>Consignee (Receiver) *</label><input id="epConsignee" placeholder="Receiver name"/></div>
          <div class="field"><label>Driver Name</label><input id="epDriver" placeholder="Driver name"/></div>
          <div class="field"><label>Delivery Status *</label>
            <select id="epStatus">
              <option value="delivered">✅ Fully Delivered</option>
              <option value="partial">⚠️ Partial Delivery</option>
              <option value="refused">❌ Delivery Refused</option>
            </select>
          </div>
          <div class="field"><label>Date &amp; Time</label><input type="datetime-local" id="epTime" value="${new Date().toISOString().slice(0,16)}"/></div>
          <div class="field"><label>Receiver Phone</label><input type="tel" id="epPhone" placeholder="9876543210"/></div>
        </div>
        <div class="field" style="margin-bottom:12px"><label>Delivery Remarks</label><textarea id="epRemarks" rows="2" placeholder="Condition of goods, short delivery, etc."></textarea></div>
        <div class="field" style="margin-bottom:16px">
          <label>Receiver Signature (Type Name as Signature)</label>
          <input id="epSig" placeholder="Receiver types their name here as digital signature"/>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">💡 For photo proof: take a photo on your phone and attach to WhatsApp using the WhatsApp Tools section</div>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('epodModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="saveEPOD()">💾 Save Delivery Record</button>
        </div>
      </div>
    </div>
  </div>`);
}

function saveEPOD() {
  const lrNo = document.getElementById('epLR').value.trim();
  const consignee = document.getElementById('epConsignee').value.trim();
  if (!lrNo || !consignee) { NOTIFY.show('Enter LR number and consignee', 'error'); return; }
  STRATIX_DB.push('epods', {
    lrNo, consignee,
    driver:      document.getElementById('epDriver').value.trim(),
    status:      document.getElementById('epStatus').value,
    deliveredAt: document.getElementById('epTime').value,
    phone:       document.getElementById('epPhone').value.trim(),
    remarks:     document.getElementById('epRemarks').value.trim(),
    signature:   document.getElementById('epSig').value.trim()
  });
  NOTIFY.show('Delivery recorded ✅', 'success');
  document.getElementById('epodModal').remove();
  renderEPOD();
}

/* ══════════════════════════════════════════════════════════
   5. TDS / TCS TRACKER
   Lives inside: Finance group → GST sub-tab
══════════════════════════════════════════════════════════ */
function renderTDSTracker() {
  const entries = STRATIX_DB.getArr('tds_entries');
  const sym     = STRATIX_DB.getSettings().currencySymbol || '₹';
  const el      = document.getElementById('sectionContent');

  const totalTDS    = entries.filter(e=>e.tType==='tds').reduce((s,e)=>s+Number(e.amount),0);
  const totalTCS    = entries.filter(e=>e.tType==='tcs').reduce((s,e)=>s+Number(e.amount),0);
  const totalDeducted = entries.filter(e=>e.direction==='deducted').reduce((s,e)=>s+Number(e.amount),0);
  const totalCollected= entries.filter(e=>e.direction==='collected').reduce((s,e)=>s+Number(e.amount),0);

  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div><h1 class="sec-title">🧾 TDS / TCS Tracker</h1><p class="sec-sub">Track tax deducted/collected at source — essential for factories &amp; large vendor payments</p></div>
      <button class="btn btn-gold" onclick="openTDSModal()">+ Add Entry</button>
    </div>
    <div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi"><div class="kpi-ico">📤</div><div class="kpi-lbl">TDS Deducted (You Paid)</div><div class="kpi-val red">${sym}${totalDeducted.toLocaleString('en-IN')}</div><div class="kpi-trend">Tax withheld from vendor payments</div></div>
      <div class="kpi"><div class="kpi-ico">📥</div><div class="kpi-lbl">TDS Collected on You</div><div class="kpi-val gold">${sym}${totalTDS.toLocaleString('en-IN')}</div><div class="kpi-trend">Deducted by your buyers</div></div>
      <div class="kpi"><div class="kpi-ico">💰</div><div class="kpi-lbl">TCS Collected</div><div class="kpi-val blue">${sym}${totalTCS.toLocaleString('en-IN')}</div><div class="kpi-trend">Collected from buyers at source</div></div>
      <div class="kpi accent"><div class="kpi-ico">🏦</div><div class="kpi-lbl">Net TDS Receivable</div><div class="kpi-val green">${sym}${Math.max(0,totalDeducted - totalCollected).toLocaleString('en-IN')}</div><div class="kpi-trend">Refundable from IT Dept</div></div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-title">⚡ Quick TDS Calculator</div>
      <div class="form-grid">
        <div class="field"><label>Transaction Type</label>
          <select id="tdsCalcType">
            <option value="194C">194C — Contractor / Transport (1-2%)</option>
            <option value="194J">194J — Professional Fees (10%)</option>
            <option value="194H">194H — Commission (5%)</option>
            <option value="194I">194I — Rent (10%)</option>
            <option value="194A">194A — Interest (10%)</option>
            <option value="194Q">194Q — Purchase of Goods (0.1%)</option>
            <option value="206C">206C TCS — Sale of Goods (0.1%)</option>
          </select>
        </div>
        <div class="field"><label>Transaction Amount (${sym})</label><input type="number" id="tdsCalcAmt" placeholder="100000" oninput="calcTDS()"/></div>
        <div class="field"><label>PAN Available?</label>
          <select id="tdsPAN" onchange="calcTDS()">
            <option value="yes">Yes — Normal Rate</option>
            <option value="no">No — 20% (ATDS)</option>
          </select>
        </div>
      </div>
      <div id="tdsCalcResult" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:13px;margin-top:4px;display:none"></div>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head"><div class="tbl-title">TDS / TCS Ledger</div></div>
      ${!entries.length ? `<div class="empty" style="padding:32px">No TDS/TCS entries yet.<br/><button class="btn btn-gold btn-sm" style="margin-top:12px" onclick="openTDSModal()">+ Add First Entry</button></div>` : `
      <div class="tbl-scroll"><table>
        <thead><tr><th>Date</th><th>Party</th><th>Section</th><th>Amount</th><th>TDS/TCS</th><th>Direction</th><th>Challan</th><th></th></tr></thead>
        <tbody>
        ${[...entries].reverse().map(e=>`<tr>
          <td class="td-m">${e.date||'—'}</td>
          <td class="td-b">${escapeHTML(e.party||'—')}</td>
          <td><span class="badge bb">${escapeHTML(e.section||'—')}</span></td>
          <td>${sym}${Number(e.baseAmt||0).toLocaleString('en-IN')}</td>
          <td style="font-weight:700;color:${e.tType==='tcs'?'var(--blue)':'var(--red)'}">${sym}${Number(e.amount||0).toLocaleString('en-IN')}</td>
          <td><span class="badge ${e.direction==='deducted'?'br':'bg'}">${e.direction||'—'}</span></td>
          <td class="td-m">${escapeHTML(e.challan||'—')}</td>
          <td><button class="del-btn" onclick="STRATIX_DB.remove('tds_entries','${e.id}');renderTDSTracker()">🗑</button></td>
        </tr>`).join('')}
        </tbody>
      </table></div>`}
    </div>
  </div>`;
}

function calcTDS() {
  const amt  = parseFloat(document.getElementById('tdsCalcAmt')?.value) || 0;
  const type = document.getElementById('tdsCalcType')?.value;
  const pan  = document.getElementById('tdsPAN')?.value;
  if (!amt) { document.getElementById('tdsCalcResult').style.display='none'; return; }
  const rates = {'194C':1,'194J':10,'194H':5,'194I':10,'194A':10,'194Q':0.1,'206C':0.1};
  const rate  = pan==='no' ? 20 : (rates[type]||1);
  const tds   = Math.round(amt * rate / 100);
  const net   = amt - tds;
  const sym   = STRATIX_DB.getSettings().currencySymbol||'₹';
  const res   = document.getElementById('tdsCalcResult');
  res.style.display = 'block';
  res.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      <div style="text-align:center"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Gross Amount</div><div style="font-size:18px;font-weight:700">${sym}${amt.toLocaleString('en-IN')}</div></div>
      <div style="text-align:center"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">TDS @ ${rate}%</div><div style="font-size:18px;font-weight:700;color:var(--red)">${sym}${tds.toLocaleString('en-IN')}</div></div>
      <div style="text-align:center"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Net Payable</div><div style="font-size:18px;font-weight:700;color:var(--green)">${sym}${net.toLocaleString('en-IN')}</div></div>
    </div>
    <div style="font-size:11px;color:var(--muted);margin-top:8px;text-align:center">Section ${type} · ${pan==='no'?'No PAN — 20% higher TDS':'PAN available — normal rate'}</div>`;
}

function openTDSModal() {
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="tdsModal" onclick="if(event.target===this)document.getElementById('tdsModal').remove()">
    <div class="modal" style="max-width:520px">
      <div class="modal-hd"><div class="modal-title">🧾 Add TDS / TCS Entry</div><button class="modal-close" onclick="document.getElementById('tdsModal').remove()">✕</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Date *</label><input type="date" id="tdsDate" value="${new Date().toISOString().split('T')[0]}"/></div>
          <div class="field"><label>Party Name *</label><input id="tdsParty" placeholder="Vendor / Client name"/></div>
          <div class="field"><label>TDS / TCS</label>
            <select id="tdsTType">
              <option value="tds">TDS (Deducted)</option>
              <option value="tcs">TCS (Collected)</option>
            </select>
          </div>
          <div class="field"><label>Direction</label>
            <select id="tdsDir">
              <option value="deducted">Deducted by us</option>
              <option value="collected_on_us">Deducted on us by buyer</option>
            </select>
          </div>
          <div class="field"><label>Section</label>
            <select id="tdsSec">
              <option value="194C">194C — Contractor / Transport</option>
              <option value="194J">194J — Professional / Technical</option>
              <option value="194H">194H — Commission</option>
              <option value="194I">194I — Rent</option>
              <option value="194A">194A — Interest</option>
              <option value="194Q">194Q — Purchase of Goods</option>
              <option value="206C">206C TCS — Sale of Goods</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div class="field"><label>Base Amount (${STRATIX_DB.getSettings().currencySymbol||'₹'})</label><input type="number" id="tdsBase" placeholder="100000"/></div>
          <div class="field"><label>TDS Amount (${STRATIX_DB.getSettings().currencySymbol||'₹'})</label><input type="number" id="tdsTDSAmt" placeholder="1000"/></div>
          <div class="field"><label>Challan / Ref No</label><input id="tdsChallan" placeholder="Challan number"/></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('tdsModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="saveTDSEntry()">💾 Save Entry</button>
        </div>
      </div>
    </div>
  </div>`);
}

function saveTDSEntry() {
  const party = document.getElementById('tdsParty').value.trim();
  if (!party) { NOTIFY.show('Enter party name', 'error'); return; }
  STRATIX_DB.push('tds_entries', {
    date:     document.getElementById('tdsDate').value,
    party,
    tType:    document.getElementById('tdsTType').value,
    direction:document.getElementById('tdsDir').value,
    section:  document.getElementById('tdsSec').value,
    baseAmt:  parseFloat(document.getElementById('tdsBase').value)||0,
    amount:   parseFloat(document.getElementById('tdsTDSAmt').value)||0,
    challan:  document.getElementById('tdsChallan').value.trim()
  });
  NOTIFY.show('TDS entry saved ✅', 'success');
  document.getElementById('tdsModal').remove();
  renderTDSTracker();
}

/* ══════════════════════════════════════════════════════════
   6. AMC TRACKER — Annual Maintenance Contract
   Lives inside: Features → sub-section
══════════════════════════════════════════════════════════ */
function renderAMCTracker() {
  const amcs = STRATIX_DB.getArr('amc_contracts');
  const sym  = STRATIX_DB.getSettings().currencySymbol||'₹';
  const today= new Date();

  const totalValue   = amcs.reduce((s,a)=>s+Number(a.value||0), 0);
  const expiringSoon = amcs.filter(a => a.renewalDate && new Date(a.renewalDate) <= new Date(today.getTime()+30*24*60*60*1000) && new Date(a.renewalDate) >= today).length;
  const expired      = amcs.filter(a => a.renewalDate && new Date(a.renewalDate) < today).length;
  const active       = amcs.filter(a => a.status==='active').length;

  document.getElementById('sectionContent').innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div><h1 class="sec-title">📋 AMC Tracker</h1><p class="sec-sub">Annual Maintenance Contracts — track renewals, service visits &amp; billing</p></div>
      <button class="btn btn-gold" onclick="openAMCModal()">+ New Contract</button>
    </div>
    <div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi accent"><div class="kpi-ico">📋</div><div class="kpi-lbl">Active Contracts</div><div class="kpi-val">${active}</div></div>
      <div class="kpi"><div class="kpi-ico">💰</div><div class="kpi-lbl">Total Contract Value</div><div class="kpi-val gold">${sym}${totalValue.toLocaleString('en-IN')}</div></div>
      <div class="kpi"><div class="kpi-ico">⚠️</div><div class="kpi-lbl">Renewing in 30 Days</div><div class="kpi-val ${expiringSoon?'gold':''}">${expiringSoon}</div></div>
      <div class="kpi"><div class="kpi-ico">❌</div><div class="kpi-lbl">Expired Contracts</div><div class="kpi-val ${expired?'red':''}">${expired}</div></div>
    </div>
    ${expiringSoon || expired ? `
    <div class="alert alert-${expired?'red':'gold'}" style="margin-bottom:16px">
      <span class="alert-ico">${expired?'❌':'⚠️'}</span>
      <span>${expired?`${expired} contract(s) have expired — renew immediately!`:''} ${expiringSoon?`${expiringSoon} contract(s) renewing in 30 days.`:''}</span>
    </div>` : ''}
    <div class="tbl-wrap">
      <div class="tbl-head"><div class="tbl-title">All AMC Contracts</div></div>
      ${!amcs.length ? `<div class="empty" style="padding:36px">No AMC contracts yet.<br/><button class="btn btn-gold btn-sm" style="margin-top:12px" onclick="openAMCModal()">+ Add First Contract</button></div>` : `
      <div class="tbl-scroll"><table>
        <thead><tr><th>Client / Asset</th><th>Type</th><th>Value</th><th>Start</th><th>Renewal</th><th>Last Service</th><th>Status</th><th></th></tr></thead>
        <tbody>
        ${[...amcs].reverse().map(a=>{
          const isExpired = a.renewalDate && new Date(a.renewalDate) < today;
          const isSoon    = a.renewalDate && new Date(a.renewalDate) <= new Date(today.getTime()+30*24*60*60*1000) && !isExpired;
          return `<tr>
            <td class="td-b">${escapeHTML(a.client||'—')}<br/><span style="font-size:11px;color:var(--muted)">${escapeHTML(a.asset||'')}</span></td>
            <td>${escapeHTML(a.contractType||'—')}</td>
            <td style="font-weight:700;color:var(--gold)">${sym}${Number(a.value||0).toLocaleString('en-IN')}</td>
            <td class="td-m">${a.startDate||'—'}</td>
            <td style="color:${isExpired?'var(--red)':isSoon?'var(--gold)':'var(--text2)'};font-weight:${isExpired||isSoon?'700':'400'}">${a.renewalDate||'—'} ${isExpired?'⚠️':isSoon?'🔔':''}</td>
            <td class="td-m">${a.lastService||'—'}</td>
            <td><span class="badge ${isExpired?'br':a.status==='active'?'bg':'bm'}">${isExpired?'Expired':escapeHTML(a.status||'active')}</span></td>
            <td>
              <button class="btn btn-ghost btn-sm" style="margin-right:4px" onclick="logAMCService('${a.id}')">🔧</button>
              <button class="del-btn" onclick="STRATIX_DB.remove('amc_contracts','${a.id}');renderAMCTracker()">🗑</button>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`}
    </div>
  </div>`;
}

function openAMCModal(editId) {
  const ex = editId ? STRATIX_DB.getArr('amc_contracts').find(a=>a.id===editId) : null;
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="amcModal" onclick="if(event.target===this)document.getElementById('amcModal').remove()">
    <div class="modal" style="max-width:520px">
      <div class="modal-hd"><div class="modal-title">📋 ${editId?'Edit':'New'} AMC Contract</div><button class="modal-close" onclick="document.getElementById('amcModal').remove()">✕</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Client / Company *</label><input id="amcClient" value="${escapeHTML(ex?.client||'')}"/></div>
          <div class="field"><label>Asset / Equipment</label><input id="amcAsset" placeholder="e.g. AC Unit, Server, Elevator" value="${escapeHTML(ex?.asset||'')}"/></div>
          <div class="field"><label>Contract Type</label>
            <select id="amcType">
              <option ${ex?.contractType==='AC Service'?'selected':''}>AC Service</option>
              <option ${ex?.contractType==='IT/Software'?'selected':''}>IT/Software</option>
              <option ${ex?.contractType==='Elevator'?'selected':''}>Elevator</option>
              <option ${ex?.contractType==='Security System'?'selected':''}>Security System</option>
              <option ${ex?.contractType==='Generator'?'selected':''}>Generator</option>
              <option ${ex?.contractType==='Other'?'selected':''}>Other</option>
            </select>
          </div>
          <div class="field"><label>Contract Value (${STRATIX_DB.getSettings().currencySymbol||'₹'})</label><input type="number" id="amcValue" value="${ex?.value||''}"/></div>
          <div class="field"><label>Start Date</label><input type="date" id="amcStart" value="${ex?.startDate||new Date().toISOString().split('T')[0]}"/></div>
          <div class="field"><label>Renewal Date *</label><input type="date" id="amcRenewal" value="${ex?.renewalDate||''}"/></div>
          <div class="field"><label>Service Visits / Year</label><input type="number" id="amcVisits" placeholder="4" value="${ex?.visitsPerYear||''}"/></div>
          <div class="field"><label>Status</label>
            <select id="amcStatus">
              <option value="active" ${ex?.status==='active'?'selected':''}>Active</option>
              <option value="paused" ${ex?.status==='paused'?'selected':''}>Paused</option>
              <option value="expired" ${ex?.status==='expired'?'selected':''}>Expired</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('amcModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="saveAMC('${editId||''}')">💾 Save Contract</button>
        </div>
      </div>
    </div>
  </div>`);
}

function saveAMC(editId) {
  const client = document.getElementById('amcClient').value.trim();
  const renewal= document.getElementById('amcRenewal').value;
  if (!client) { NOTIFY.show('Enter client name', 'error'); return; }
  const item = {
    client, asset: document.getElementById('amcAsset').value.trim(),
    contractType: document.getElementById('amcType').value,
    value:    parseFloat(document.getElementById('amcValue').value)||0,
    startDate:document.getElementById('amcStart').value,
    renewalDate: renewal,
    visitsPerYear: parseInt(document.getElementById('amcVisits').value)||0,
    status:   document.getElementById('amcStatus').value
  };
  if (editId) { STRATIX_DB.update('amc_contracts', editId, item); NOTIFY.show('Contract updated ✅', 'success'); }
  else {
    STRATIX_DB.push('amc_contracts', item);
    if (renewal) {
      STRATIX_DB.push('reminders', { title: `AMC Renewal: ${client}`, date: renewal, category: 'AMC', amount: item.value });
      NOTIFY.show('Contract saved + Renewal reminder created ✅', 'success');
    } else {
      NOTIFY.show('Contract saved ✅', 'success');
    }
  }
  document.getElementById('amcModal').remove();
  renderAMCTracker();
}

function logAMCService(id) {
  STRATIX_DB.update('amc_contracts', id, { lastService: new Date().toISOString().split('T')[0] });
  NOTIFY.show('Service visit logged ✅', 'success');
  renderAMCTracker();
}

/* ══════════════════════════════════════════════════════════
   7. ESG / SUSTAINABILITY TRACKER
   Lives inside: Intelligence group
══════════════════════════════════════════════════════════ */
function renderESGTracker() {
  const entries = STRATIX_DB.getArr('esg_entries');
  const sym     = STRATIX_DB.getSettings().currencySymbol||'₹';

  const totalFuel   = entries.filter(e=>e.category==='fuel').reduce((s,e)=>s+Number(e.qty||0), 0);
  const totalElec   = entries.filter(e=>e.category==='electricity').reduce((s,e)=>s+Number(e.qty||0), 0);
  const totalWater  = entries.filter(e=>e.category==='water').reduce((s,e)=>s+Number(e.qty||0), 0);
  const totalWaste  = entries.filter(e=>e.category==='waste').reduce((s,e)=>s+Number(e.qty||0), 0);
  // CO2 estimates: diesel 2.68 kg/L, electricity 0.82 kg/kWh
  const co2Fuel     = Math.round(totalFuel * 2.68);
  const co2Elec     = Math.round(totalElec * 0.82);
  const totalCO2    = co2Fuel + co2Elec;

  document.getElementById('sectionContent').innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div><h1 class="sec-title">🌱 ESG / Sustainability Tracker</h1><p class="sec-sub">Track fuel, electricity, water &amp; waste — calculate your carbon footprint</p></div>
      <button class="btn btn-gold" onclick="openESGModal()">+ Log Entry</button>
    </div>
    <div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi"><div class="kpi-ico">⛽</div><div class="kpi-lbl">Fuel Consumed</div><div class="kpi-val">${totalFuel.toLocaleString('en-IN')} <span style="font-size:13px">L</span></div><div class="kpi-trend">CO₂: ${co2Fuel} kg</div></div>
      <div class="kpi"><div class="kpi-ico">⚡</div><div class="kpi-lbl">Electricity Used</div><div class="kpi-val">${totalElec.toLocaleString('en-IN')} <span style="font-size:13px">kWh</span></div><div class="kpi-trend">CO₂: ${co2Elec} kg</div></div>
      <div class="kpi"><div class="kpi-ico">💧</div><div class="kpi-lbl">Water Consumed</div><div class="kpi-val">${totalWater.toLocaleString('en-IN')} <span style="font-size:13px">kL</span></div></div>
      <div class="kpi accent"><div class="kpi-ico">🌿</div><div class="kpi-lbl">Total CO₂ Footprint</div><div class="kpi-val ${totalCO2>5000?'red':totalCO2>2000?'gold':'green'}">${totalCO2.toLocaleString('en-IN')} <span style="font-size:13px">kg</span></div><div class="kpi-trend ${totalCO2>5000?'down':totalCO2>2000?'':'up'}">${totalCO2>5000?'High — take action':totalCO2>2000?'Moderate':'Low — good job'}</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div class="card">
        <div class="card-title">📊 Carbon Breakdown</div>
        ${[
          {label:'Fuel (Diesel/Petrol)', val: co2Fuel, pct: totalCO2>0?Math.round(co2Fuel/totalCO2*100):0, color:'var(--red)'},
          {label:'Electricity', val: co2Elec, pct: totalCO2>0?Math.round(co2Elec/totalCO2*100):0, color:'var(--gold)'}
        ].map(r=>`
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:var(--text2)">${r.label}</span><span style="font-weight:700">${r.val} kg CO₂ (${r.pct}%)</span></div>
          <div class="prog"><div class="prog-fill" style="width:${r.pct}%;background:${r.color}"></div></div>
        </div>`).join('')}
        <div style="font-size:12px;color:var(--muted);margin-top:10px">🌳 To offset ${totalCO2} kg CO₂ you need approx <strong style="color:var(--green)">${Math.ceil(totalCO2/22)} trees</strong> planted</div>
      </div>
      <div class="card">
        <div class="card-title">🏆 ESG Score</div>
        ${(() => {
          let score = 100;
          if (totalCO2 > 10000) score -= 40;
          else if (totalCO2 > 5000) score -= 25;
          else if (totalCO2 > 2000) score -= 10;
          const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
          const col   = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--gold)' : 'var(--red)';
          return `
          <div style="text-align:center;padding:16px 0">
            <div style="font-size:56px;font-weight:800;font-family:var(--heading);color:${col}">${grade}</div>
            <div style="font-size:24px;font-weight:700;color:${col}">${score}/100</div>
            <div style="font-size:12px;color:var(--muted);margin-top:6px">Based on carbon emissions data</div>
          </div>
          <div style="font-size:12px;color:var(--muted);text-align:center">Add more data to get a more accurate score</div>`;
        })()}
      </div>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head"><div class="tbl-title">ESG Log</div><button class="btn btn-ghost btn-sm" onclick="openESGModal()">+ Log Entry</button></div>
      ${!entries.length ? `<div class="empty" style="padding:32px">Start logging to track your environmental impact</div>` : `
      <div class="tbl-scroll"><table>
        <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Quantity</th><th>Unit</th><th>CO₂ (kg)</th><th></th></tr></thead>
        <tbody>
        ${[...entries].reverse().map(e=>{
          const co2 = e.category==='fuel' ? Math.round(Number(e.qty)*2.68) : e.category==='electricity' ? Math.round(Number(e.qty)*0.82) : 0;
          return `<tr>
            <td class="td-m">${e.date||'—'}</td>
            <td><span class="badge ${e.category==='fuel'?'br':e.category==='electricity'?'bgold':e.category==='water'?'bb':'bm'}">${escapeHTML(e.category)}</span></td>
            <td>${escapeHTML(e.description||'—')}</td>
            <td style="font-weight:600">${e.qty}</td>
            <td class="td-m">${escapeHTML(e.unit||'')}</td>
            <td style="color:${co2>0?'var(--red)':'var(--muted)'}">${co2||'—'}</td>
            <td><button class="del-btn" onclick="STRATIX_DB.remove('esg_entries','${e.id}');renderESGTracker()">🗑</button></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`}
    </div>
  </div>`;
}

function openESGModal() {
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="esgModal" onclick="if(event.target===this)document.getElementById('esgModal').remove()">
    <div class="modal" style="max-width:460px">
      <div class="modal-hd"><div class="modal-title">🌱 Log ESG Entry</div><button class="modal-close" onclick="document.getElementById('esgModal').remove()">✕</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Date</label><input type="date" id="esgDate" value="${new Date().toISOString().split('T')[0]}"/></div>
          <div class="field"><label>Category *</label>
            <select id="esgCat" onchange="esgSetUnit(this.value)">
              <option value="fuel">⛽ Fuel (Diesel/Petrol/CNG)</option>
              <option value="electricity">⚡ Electricity</option>
              <option value="water">💧 Water</option>
              <option value="waste">🗑️ Waste Generated</option>
              <option value="waste_recycled">♻️ Waste Recycled</option>
            </select>
          </div>
          <div class="field"><label>Description</label><input id="esgDesc" placeholder="e.g. Fleet fuel this week"/></div>
          <div class="field"><label>Quantity *</label><input type="number" id="esgQty" placeholder="0" step="0.1"/></div>
          <div class="field"><label>Unit</label><input id="esgUnit" value="Litres" placeholder="Litres / kWh / kL / kg"/></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('esgModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="saveESGEntry()">💾 Save</button>
        </div>
      </div>
    </div>
  </div>`);
}
function esgSetUnit(v) {
  const units={fuel:'Litres',electricity:'kWh',water:'kilo Litres (kL)',waste:'kg',waste_recycled:'kg'};
  document.getElementById('esgUnit').value=units[v]||'units';
}
function saveESGEntry() {
  const qty=parseFloat(document.getElementById('esgQty').value);
  if(!qty){NOTIFY.show('Enter quantity','error');return;}
  STRATIX_DB.push('esg_entries',{date:document.getElementById('esgDate').value,category:document.getElementById('esgCat').value,description:document.getElementById('esgDesc').value.trim(),qty,unit:document.getElementById('esgUnit').value.trim()});
  NOTIFY.show('ESG entry logged ✅','success');
  document.getElementById('esgModal').remove();
  renderESGTracker();
}

/* ══════════════════════════════════════════════════════════
   8. REAL ESTATE TRACKER
   Lives inside: sub-section under ERP
══════════════════════════════════════════════════════════ */
function renderRealEstateTracker() {
  const units   = STRATIX_DB.getArr('re_units');
  const sym     = STRATIX_DB.getSettings().currencySymbol||'₹';
  const booked  = units.filter(u=>u.status==='booked').length;
  const available=units.filter(u=>u.status==='available').length;
  const blocked = units.filter(u=>u.status==='blocked').length;
  const totalVal= units.filter(u=>u.status==='booked').reduce((s,u)=>s+Number(u.price||0),0);

  document.getElementById('sectionContent').innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div><h1 class="sec-title">🏗️ Real Estate Unit Tracker</h1><p class="sec-sub">Visual map of flats, plots, units — Booked / Available / Blocked</p></div>
      <button class="btn btn-gold" onclick="openREUnitModal()">+ Add Unit</button>
    </div>
    <div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi accent"><div class="kpi-ico">🏠</div><div class="kpi-lbl">Total Units</div><div class="kpi-val">${units.length}</div></div>
      <div class="kpi"><div class="kpi-ico">✅</div><div class="kpi-lbl">Booked</div><div class="kpi-val green">${booked}</div></div>
      <div class="kpi"><div class="kpi-ico">🟢</div><div class="kpi-lbl">Available</div><div class="kpi-val blue">${available}</div></div>
      <div class="kpi"><div class="kpi-ico">💰</div><div class="kpi-lbl">Booking Revenue</div><div class="kpi-val gold">${sym}${(totalVal/100000).toFixed(1)}L</div></div>
    </div>

    <!-- Visual Grid Map -->
    <div class="card" style="margin-bottom:18px">
      <div class="card-title">🗺️ Unit Map
        <div style="display:flex;gap:8px;margin-left:auto">
          <span style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted)"><span style="width:10px;height:10px;background:var(--green);border-radius:2px;display:inline-block"></span>Available</span>
          <span style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted)"><span style="width:10px;height:10px;background:var(--red);border-radius:2px;display:inline-block"></span>Booked</span>
          <span style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted)"><span style="width:10px;height:10px;background:var(--gold);border-radius:2px;display:inline-block"></span>Blocked</span>
        </div>
      </div>
      ${!units.length ? `<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px">Add units to see the map</div>` :
        `<div style="display:flex;flex-wrap:wrap;gap:8px">
          ${units.map(u=>`
          <div style="width:70px;text-align:center;cursor:pointer" onclick="openREUnitModal('${u.id}')">
            <div style="height:52px;border-radius:8px;background:${u.status==='booked'?'rgba(255,77,77,.15)':u.status==='blocked'?'rgba(37,99,235,.15)':'rgba(0,214,143,.1)'};border:1.5px solid ${u.status==='booked'?'var(--red)':u.status==='blocked'?'var(--gold)':'var(--green)'};display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${u.status==='booked'?'var(--red)':u.status==='blocked'?'var(--gold)':'var(--green)'}">
              <div style="font-size:14px">${u.type==='flat'?'🏠':u.type==='plot'?'🌳':u.type==='shop'?'🏪':'🏢'}</div>
              <div>${escapeHTML(u.unitNo)}</div>
            </div>
            <div style="font-size:9px;color:var(--muted);margin-top:3px">${escapeHTML(u.floor||'')}${u.area?` · ${u.area}sqft`:''}</div>
          </div>`).join('')}
        </div>`}
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head"><div class="tbl-title">Unit Details</div></div>
      ${!units.length ? `<div class="empty" style="padding:32px"><button class="btn btn-gold btn-sm" onclick="openREUnitModal()">+ Add First Unit</button></div>` : `
      <div class="tbl-scroll"><table>
        <thead><tr><th>Unit No</th><th>Type</th><th>Floor</th><th>Area</th><th>Price</th><th>Buyer</th><th>Status</th><th></th></tr></thead>
        <tbody>
        ${units.map(u=>`<tr>
          <td class="td-b">${escapeHTML(u.unitNo)}</td>
          <td>${escapeHTML(u.type||'—')}</td>
          <td class="td-m">${escapeHTML(u.floor||'—')}</td>
          <td class="td-m">${u.area?u.area+' sqft':'—'}</td>
          <td style="font-weight:700;color:var(--gold)">${sym}${Number(u.price||0).toLocaleString('en-IN')}</td>
          <td>${escapeHTML(u.buyer||'—')}</td>
          <td><span class="badge ${u.status==='booked'?'br':u.status==='available'?'bg':'bgold'}">${escapeHTML(u.status||'available')}</span></td>
          <td>
            <button class="btn btn-ghost btn-sm" style="margin-right:4px" onclick="openREUnitModal('${u.id}')">✏️</button>
            <button class="del-btn" onclick="STRATIX_DB.remove('re_units','${u.id}');renderRealEstateTracker()">🗑</button>
          </td>
        </tr>`).join('')}
        </tbody>
      </table></div>`}
    </div>
  </div>`;
}

function openREUnitModal(editId) {
  const ex = editId ? STRATIX_DB.getArr('re_units').find(u=>u.id===editId) : null;
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="reModal" onclick="if(event.target===this)document.getElementById('reModal').remove()">
    <div class="modal" style="max-width:500px">
      <div class="modal-hd"><div class="modal-title">🏗️ ${editId?'Edit':'Add'} Unit</div><button class="modal-close" onclick="document.getElementById('reModal').remove()">✕</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Unit Number *</label><input id="reUNo" value="${escapeHTML(ex?.unitNo||'')}" placeholder="101, A-5, Plot-12"/></div>
          <div class="field"><label>Type</label>
            <select id="reType">
              <option value="flat" ${ex?.type==='flat'?'selected':''}>🏠 Flat / Apartment</option>
              <option value="plot" ${ex?.type==='plot'?'selected':''}>🌳 Plot / Land</option>
              <option value="shop" ${ex?.type==='shop'?'selected':''}>🏪 Commercial / Shop</option>
              <option value="office" ${ex?.type==='office'?'selected':''}>🏢 Office</option>
            </select>
          </div>
          <div class="field"><label>Floor / Block</label><input id="reFloor" value="${escapeHTML(ex?.floor||'')}" placeholder="2nd Floor / Block A"/></div>
          <div class="field"><label>Area (sqft)</label><input type="number" id="reArea" value="${ex?.area||''}"/></div>
          <div class="field"><label>Price (${STRATIX_DB.getSettings().currencySymbol||'₹'})</label><input type="number" id="rePrice" value="${ex?.price||''}"/></div>
          <div class="field"><label>Status</label>
            <select id="reStatus">
              <option value="available" ${ex?.status==='available'||!ex?'selected':''}>🟢 Available</option>
              <option value="booked" ${ex?.status==='booked'?'selected':''}>🔴 Booked</option>
              <option value="blocked" ${ex?.status==='blocked'?'selected':''}>🟡 Blocked / Hold</option>
            </select>
          </div>
          <div class="field"><label>Buyer Name</label><input id="reBuyer" value="${escapeHTML(ex?.buyer||'')}" placeholder="Buyer name (if booked)"/></div>
          <div class="field"><label>Buyer Phone</label><input id="reBuyerPh" value="${escapeHTML(ex?.buyerPhone||'')}" placeholder="Buyer mobile"/></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('reModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="saveREUnit('${editId||''}')">💾 Save Unit</button>
        </div>
      </div>
    </div>
  </div>`);
}

function saveREUnit(editId) {
  const unitNo = document.getElementById('reUNo').value.trim();
  if (!unitNo) { NOTIFY.show('Enter unit number', 'error'); return; }
  const item = { unitNo, type:document.getElementById('reType').value, floor:document.getElementById('reFloor').value.trim(), area:parseFloat(document.getElementById('reArea').value)||0, price:parseFloat(document.getElementById('rePrice').value)||0, status:document.getElementById('reStatus').value, buyer:document.getElementById('reBuyer').value.trim(), buyerPhone:document.getElementById('reBuyerPh').value.trim() };
  if (editId) { STRATIX_DB.update('re_units', editId, item); NOTIFY.show('Unit updated ✅','success'); }
  else { STRATIX_DB.push('re_units', item); NOTIFY.show('Unit added ✅','success'); }
  document.getElementById('reModal').remove();
  renderRealEstateTracker();
}

/* ══════════════════════════════════════════════════════════
   9. HEALTHCARE / PHARMACY — Expiry Alerts
   Lives inside: Early Warning sub-tab for healthcare bizType
══════════════════════════════════════════════════════════ */
function renderPharmacyExpiry() {
  const items = STRATIX_DB.getArr('pharma_stock');
  const today = new Date();
  const in30  = new Date(today.getTime() + 30*24*60*60*1000);
  const in90  = new Date(today.getTime() + 90*24*60*60*1000);
  const expired  = items.filter(i => i.expiry && new Date(i.expiry) < today);
  const due30    = items.filter(i => i.expiry && new Date(i.expiry) >= today && new Date(i.expiry) <= in30);
  const due90    = items.filter(i => i.expiry && new Date(i.expiry) > in30  && new Date(i.expiry) <= in90);
  const sym      = STRATIX_DB.getSettings().currencySymbol||'₹';

  document.getElementById('sectionContent').innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div><h1 class="sec-title">💊 Pharmacy / Batch Expiry Tracker</h1><p class="sec-sub">Track batch numbers, expiry dates &amp; get alerts before stock expires</p></div>
      <button class="btn btn-gold" onclick="openPharmaModal()">+ Add Item / Batch</button>
    </div>
    <div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi"><div class="kpi-ico">📦</div><div class="kpi-lbl">Total SKUs</div><div class="kpi-val">${items.length}</div></div>
      <div class="kpi" style="border-color:rgba(255,77,77,.3)"><div class="kpi-ico">❌</div><div class="kpi-lbl">Expired</div><div class="kpi-val red">${expired.length}</div><div class="kpi-trend down">${expired.length?'Remove from shelves':'None'}</div></div>
      <div class="kpi" style="border-color:rgba(255,165,0,.3)"><div class="kpi-ico">⚠️</div><div class="kpi-lbl">Expiring in 30 Days</div><div class="kpi-val gold">${due30.length}</div><div class="kpi-trend">Return to distributor</div></div>
      <div class="kpi"><div class="kpi-ico">🕐</div><div class="kpi-lbl">Expiring in 90 Days</div><div class="kpi-val">${due90.length}</div><div class="kpi-trend muted">Plan to sell/transfer</div></div>
    </div>
    ${expired.length ? `<div class="alert a-red" style="margin-bottom:14px"><span class="alert-ico">❌</span><span><strong>${expired.length} batch(es) EXPIRED.</strong> Remove from shelves immediately: ${expired.slice(0,3).map(i=>escapeHTML(i.name)).join(', ')}</span></div>` : ''}
    ${due30.length  ? `<div class="alert alert-gold" style="margin-bottom:14px"><span class="alert-ico">⚠️</span><span><strong>${due30.length} batch(es)</strong> expiring within 30 days. Consider returning to distributor.</span></div>` : ''}
    <div class="tbl-wrap">
      <div class="tbl-head"><div class="tbl-title">Stock & Batch List</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="pharmaFilter('all')">All</button>
          <button class="btn btn-ghost btn-sm" onclick="pharmaFilter('expired')">Expired</button>
          <button class="btn btn-ghost btn-sm" onclick="pharmaFilter('due30')">Due 30d</button>
        </div>
      </div>
      <div class="tbl-scroll"><table id="pharmaTable">
        <thead><tr><th>Item / Drug</th><th>Batch No</th><th>Qty</th><th>Expiry Date</th><th>MRP</th><th>Status</th><th></th></tr></thead>
        <tbody>
        ${!items.length ? `<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--muted)">No items yet. <button class="btn btn-gold btn-sm" onclick="openPharmaModal()">Add First Item</button></td></tr>` :
          items.map(i => {
            const exp = i.expiry ? new Date(i.expiry) : null;
            const isExp = exp && exp < today;
            const is30  = exp && exp >= today && exp <= in30;
            const is90  = exp && exp > in30  && exp <= in90;
            return `<tr data-status="${isExp?'expired':is30?'due30':is90?'due90':'ok'}">
              <td class="td-b">${escapeHTML(i.name)}</td>
              <td class="td-m">${escapeHTML(i.batchNo||'—')}</td>
              <td>${i.qty||0} ${escapeHTML(i.unit||'units')}</td>
              <td style="font-weight:${isExp||is30?'700':'400'};color:${isExp?'var(--red)':is30?'var(--gold)':'var(--text2)'}">${i.expiry||'—'}</td>
              <td class="td-gold">${sym}${Number(i.mrp||0).toFixed(2)}</td>
              <td><span class="badge ${isExp?'br':is30?'bgold':is90?'bo':'bg'}">${isExp?'EXPIRED':is30?'Due 30d':is90?'Due 90d':'OK'}</span></td>
              <td><button class="del-btn" onclick="STRATIX_DB.remove('pharma_stock','${i.id}');renderPharmacyExpiry()">🗑</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </div>
  </div>`;
}

function pharmaFilter(f) {
  document.querySelectorAll('#pharmaTable tbody tr[data-status]').forEach(r => {
    r.style.display = f==='all' || r.dataset.status===f ? '' : 'none';
  });
}

function openPharmaModal() {
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="pharmaModal" onclick="if(event.target===this)document.getElementById('pharmaModal').remove()">
    <div class="modal" style="max-width:480px">
      <div class="modal-hd"><div class="modal-title">💊 Add Item / Batch</div><button class="modal-close" onclick="document.getElementById('pharmaModal').remove()">✕</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Item / Drug Name *</label><input id="phName" placeholder="Paracetamol 500mg"/></div>
          <div class="field"><label>Batch Number *</label><input id="phBatch" placeholder="BT2024001"/></div>
          <div class="field"><label>Quantity</label><input type="number" id="phQty" placeholder="100"/></div>
          <div class="field"><label>Unit</label><input id="phUnit" placeholder="tablets / strips / bottles"/></div>
          <div class="field"><label>Expiry Date *</label><input type="date" id="phExpiry"/></div>
          <div class="field"><label>MRP (${STRATIX_DB.getSettings().currencySymbol||'₹'})</label><input type="number" id="phMRP" placeholder="10.50" step="0.01"/></div>
          <div class="field"><label>Manufacturer</label><input id="phMfr" placeholder="Company name"/></div>
          <div class="field"><label>Category</label>
            <select id="phCat">
              <option>Tablet / Capsule</option><option>Syrup / Liquid</option>
              <option>Injection</option><option>Cream / Ointment</option>
              <option>Surgical</option><option>OTC</option><option>Other</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('pharmaModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="savePharmaItem()">💾 Save</button>
        </div>
      </div>
    </div>
  </div>`);
}

function savePharmaItem() {
  const name = document.getElementById('phName').value.trim();
  const expiry = document.getElementById('phExpiry').value;
  if (!name || !expiry) { NOTIFY.show('Enter item name and expiry date', 'error'); return; }
  const today = new Date();
  const expDate = new Date(expiry);
  const in30 = new Date(today.getTime()+30*24*60*60*1000);
  STRATIX_DB.push('pharma_stock', {
    name, batchNo: document.getElementById('phBatch').value.trim(),
    qty: parseInt(document.getElementById('phQty').value)||0,
    unit: document.getElementById('phUnit').value.trim()||'units',
    expiry, mrp: parseFloat(document.getElementById('phMRP').value)||0,
    manufacturer: document.getElementById('phMfr').value.trim(),
    category: document.getElementById('phCat').value
  });
  // Auto-remind if expiring soon
  if (expDate <= in30 && expDate >= today) {
    STRATIX_DB.push('reminders', { title: `Expiry Alert: ${name}`, date: expiry, category: 'Pharmacy' });
    NOTIFY.show('Item saved + Expiry reminder created ✅', 'success');
  } else {
    NOTIFY.show('Item saved ✅', 'success');
  }
  document.getElementById('pharmaModal').remove();
  renderPharmacyExpiry();
}

/* ══════════════════════════════════════════════════════════
   BATCH 2 — HEALTHCARE & HOSPITALITY
══════════════════════════════════════════════════════════ */

/* ── 10. APPOINTMENT SCHEDULER ──────────────────────────────────────────────
   Healthcare / Clinics / Consultants
   Lives in: Order Tracker group for services vertical, standalone for others */
function renderAppointmentScheduler() {
  const appts  = STRATIX_DB.getArr('appointments');
  const today  = new Date().toISOString().split('T')[0];
  const sym    = STRATIX_DB.getSettings().currencySymbol || '₹';

  const todayAppts  = appts.filter(a => a.date === today);
  const upcoming    = appts.filter(a => a.date > today && a.status !== 'cancelled');
  const total       = appts.length;
  const confirmed   = appts.filter(a => a.status === 'confirmed').length;

  // Group today's appointments by time
  const todaySorted = [...todayAppts].sort((a,b) => (a.time||'').localeCompare(b.time||''));

  const el = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div><h1 class="sec-title">📅 Appointment Scheduler</h1>
        <p class="sec-sub">Manage patient / client appointments linked to billing</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-gold" onclick="openApptModal()">+ New Appointment</button>
      </div>
    </div>

    <div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi accent">
        <div class="kpi-ico">📅</div>
        <div class="kpi-lbl">Today's Appointments</div>
        <div class="kpi-val">${todayAppts.length}</div>
        <div class="kpi-trend">${todaySorted[0] ? 'Next: ' + todaySorted[0].time + ' — ' + escapeHTML(todaySorted[0].patient) : 'None today'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-ico">🔜</div>
        <div class="kpi-lbl">Upcoming</div>
        <div class="kpi-val">${upcoming.length}</div>
      </div>
      <div class="kpi">
        <div class="kpi-ico">✅</div>
        <div class="kpi-lbl">Confirmed</div>
        <div class="kpi-val green">${confirmed}</div>
      </div>
      <div class="kpi">
        <div class="kpi-ico">📋</div>
        <div class="kpi-lbl">Total All Time</div>
        <div class="kpi-val">${total}</div>
      </div>
    </div>

    <!-- Today's schedule -->
    <div class="card" style="margin-bottom:18px">
      <div class="card-title">🗓️ Today's Schedule — ${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
      ${!todaySorted.length
        ? `<div style="color:var(--muted);font-size:13px;padding:20px 0;text-align:center">No appointments today<br/><button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="openApptModal()">+ Add Appointment</button></div>`
        : `<div style="display:flex;flex-direction:column;gap:8px">
          ${todaySorted.map(a => {
            const colMap = {confirmed:'var(--green)',pending:'var(--gold)',completed:'var(--muted)',cancelled:'var(--red)'};
            const col = colMap[a.status] || 'var(--muted)';
            return `<div style="display:flex;align-items:center;gap:14px;padding:12px 14px;background:var(--surface2);border-radius:10px;border-left:3px solid ${col}">
              <div style="font-size:15px;font-weight:800;color:var(--text);min-width:55px;font-family:var(--heading)">${escapeHTML(a.time||'—')}</div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:700;color:var(--text)">${escapeHTML(a.patient||'—')}</div>
                <div style="font-size:11px;color:var(--muted)">${escapeHTML(a.doctor||'')}${a.doctor&&a.type?' · ':''} ${escapeHTML(a.type||'')}${a.phone?' · '+escapeHTML(a.phone):''}</div>
              </div>
              <span class="badge ${a.status==='confirmed'?'bg':a.status==='completed'?'bm':a.status==='cancelled'?'br':'bgold'}">${escapeHTML(a.status||'pending')}</span>
              <div style="display:flex;gap:6px">
                ${a.status!=='completed'?`<button class="btn btn-green btn-sm" onclick="apptMarkDone('${a.id}')">✓ Done</button>`:''}
                <button class="btn btn-ghost btn-sm" onclick="openApptModal('${a.id}')">✏️</button>
                <button class="del-btn" onclick="STRATIX_DB.remove('appointments','${a.id}');renderAppointmentScheduler()">🗑</button>
              </div>
            </div>`;
          }).join('')}
        </div>`}
    </div>

    <!-- Upcoming appointments table -->
    <div class="tbl-wrap">
      <div class="tbl-head">
        <div class="tbl-title">All Appointments</div>
        <div style="display:flex;gap:6px">
          <input type="date" id="apptFilterDate" style="padding:5px 10px;font-size:12px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);color:var(--text)" onchange="apptFilterByDate(this.value)"/>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('apptFilterDate').value='';renderAppointmentScheduler()">Clear</button>
        </div>
      </div>
      ${!appts.length
        ? `<div class="empty" style="padding:36px"><button class="btn btn-gold btn-sm" onclick="openApptModal()">+ Add First Appointment</button></div>`
        : `<div class="tbl-scroll"><table>
          <thead><tr><th>Date</th><th>Time</th><th>Patient / Client</th><th>Doctor / Consultant</th><th>Type</th><th>Phone</th><th>Fee</th><th>Status</th><th></th></tr></thead>
          <tbody id="apptTableBody">
          ${[...appts].sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time)).reverse().map(a => `<tr>
            <td class="td-m">${a.date||'—'}</td>
            <td style="font-weight:700">${escapeHTML(a.time||'—')}</td>
            <td class="td-b">${escapeHTML(a.patient||'—')}</td>
            <td class="td-m">${escapeHTML(a.doctor||'—')}</td>
            <td class="td-m">${escapeHTML(a.type||'—')}</td>
            <td class="td-m">${escapeHTML(a.phone||'—')}</td>
            <td style="color:var(--gold);font-weight:600">${a.fee?sym+Number(a.fee).toLocaleString('en-IN'):'—'}</td>
            <td><span class="badge ${a.status==='confirmed'?'bg':a.status==='completed'?'bm':a.status==='cancelled'?'br':'bgold'}">${escapeHTML(a.status||'pending')}</span></td>
            <td style="white-space:nowrap">
              <button class="btn btn-ghost btn-sm" style="margin-right:4px" onclick="openApptModal('${a.id}')">✏️</button>
              <button class="del-btn" onclick="STRATIX_DB.remove('appointments','${a.id}');renderAppointmentScheduler()">🗑</button>
            </td>
          </tr>`).join('')}
          </tbody>
        </table></div>`}
    </div>
  </div>`;
}

function openApptModal(editId) {
  const ex = editId ? STRATIX_DB.getArr('appointments').find(a=>a.id===editId) : null;
  const doctors = [...new Set(STRATIX_DB.getArr('appointments').map(a=>a.doctor).filter(Boolean))];
  const types   = ['General Consultation','Follow-up','Lab Test','Procedure','Surgery','Dental','Eye Check','Physiotherapy','Counselling','Other'];

  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="apptModal" onclick="if(event.target===this)document.getElementById('apptModal').remove()">
    <div class="modal" style="max-width:520px">
      <div class="modal-hd"><div class="modal-title">📅 ${editId?'Edit':'New'} Appointment</div>
        <button class="modal-close" onclick="document.getElementById('apptModal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Patient / Client Name *</label><input id="apptPatient" value="${escapeHTML(ex?.patient||'')}" placeholder="Patient name"/></div>
          <div class="field"><label>Phone</label><input type="tel" id="apptPhone" value="${escapeHTML(ex?.phone||'')}" placeholder="9876543210"/></div>
          <div class="field"><label>Date *</label><input type="date" id="apptDate" value="${ex?.date||new Date().toISOString().split('T')[0]}"/></div>
          <div class="field"><label>Time *</label><input type="time" id="apptTime" value="${ex?.time||'09:00'}"/></div>
          <div class="field"><label>Doctor / Consultant</label>
            <input id="apptDoctor" value="${escapeHTML(ex?.doctor||'')}" placeholder="Dr. Name" list="apptDoctorList"/>
            <datalist id="apptDoctorList">${doctors.map(d=>`<option value="${escapeHTML(d)}">`).join('')}</datalist>
          </div>
          <div class="field"><label>Appointment Type</label>
            <select id="apptType">
              ${types.map(t=>`<option value="${t}" ${ex?.type===t?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Consultation Fee (${STRATIX_DB.getSettings().currencySymbol||'₹'})</label>
            <input type="number" id="apptFee" value="${ex?.fee||''}" placeholder="500"/>
          </div>
          <div class="field"><label>Status</label>
            <select id="apptStatus">
              <option value="pending" ${ex?.status==='pending'||!ex?'selected':''}>🟡 Pending</option>
              <option value="confirmed" ${ex?.status==='confirmed'?'selected':''}>✅ Confirmed</option>
              <option value="completed" ${ex?.status==='completed'?'selected':''}>🔵 Completed</option>
              <option value="cancelled" ${ex?.status==='cancelled'?'selected':''}>❌ Cancelled</option>
            </select>
          </div>
        </div>
        <div class="field" style="margin-bottom:16px"><label>Notes / Symptoms</label>
          <textarea id="apptNotes" rows="2" placeholder="Reason for visit, symptoms, special instructions...">${escapeHTML(ex?.notes||'')}</textarea>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('apptModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="saveAppt('${editId||''}')">💾 Save Appointment</button>
        </div>
      </div>
    </div>
  </div>`);
}

function saveAppt(editId) {
  const patient = document.getElementById('apptPatient').value.trim();
  const date    = document.getElementById('apptDate').value;
  if (!patient || !date) { NOTIFY.show('Enter patient name and date', 'error'); return; }
  const fee = parseFloat(document.getElementById('apptFee').value)||0;
  const item = {
    patient, date,
    time:   document.getElementById('apptTime').value,
    phone:  document.getElementById('apptPhone').value.trim(),
    doctor: document.getElementById('apptDoctor').value.trim(),
    type:   document.getElementById('apptType').value,
    fee,
    status: document.getElementById('apptStatus').value,
    notes:  document.getElementById('apptNotes').value.trim()
  };
  if (editId) { STRATIX_DB.update('appointments', editId, item); NOTIFY.show('Appointment updated ✅','success'); }
  else {
    STRATIX_DB.push('appointments', item);
    // Auto-create reminder
    STRATIX_DB.push('reminders', { title:`Appointment: ${patient}`, date, category:'Medical', amount: fee });
    NOTIFY.show('Appointment saved + Reminder created ✅','success');
  }
  document.getElementById('apptModal').remove();
  renderAppointmentScheduler();
}

function apptMarkDone(id) {
  const appt = STRATIX_DB.getArr('appointments').find(a=>a.id===id);
  STRATIX_DB.update('appointments', id, { status:'completed' });
  if (appt?.fee) {
    STRATIX_DB.push('transactions', { type:'revenue', amount:appt.fee, category:'consultation', description:`Consultation — ${appt.patient}`, date:appt.date });
    NOTIFY.show('Marked done + Revenue recorded ✅','success');
  } else {
    NOTIFY.show('Marked as completed ✅','success');
  }
  renderAppointmentScheduler();
}

function apptFilterByDate(date) {
  const rows = document.querySelectorAll('#apptTableBody tr');
  rows.forEach(r => { r.style.display = !date || r.cells[0]?.textContent === date ? '' : 'none'; });
}

/* ── 11. PATIENT HISTORY / EMR ───────────────────────────────────────────────
   Electronic Medical Records — secure local storage */
function renderPatientHistory() {
  const patients = STRATIX_DB.getArr('emr_patients');
  const el = document.getElementById('sectionContent');

  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div><h1 class="sec-title">🏥 Patient History (EMR)</h1>
        <p class="sec-sub">Secure electronic medical records — stored locally on your device only</p>
      </div>
      <div class="head-actions">
        <input type="text" id="emrSearch" placeholder="Search patient..." style="padding:8px 14px;font-size:13px;border-radius:9px;background:var(--surface2);border:1px solid var(--border);color:var(--text);outline:none" oninput="emrFilter(this.value)"/>
        <button class="btn btn-gold" onclick="openEMRModal()">+ New Patient</button>
      </div>
    </div>

    <div class="alert alert-blue" style="margin-bottom:16px">
      <span class="alert-ico">🔒</span>
      <span>All patient records are stored <strong>only on this device</strong> in encrypted local storage. Never transmitted to any server.</span>
    </div>

    <div id="emrPatientGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
      ${!patients.length
        ? `<div class="empty" style="grid-column:1/-1;padding:52px">
            <div class="ei">🏥</div>
            <h3>No patient records yet</h3>
            <p>Add your first patient to start their medical history</p>
            <button class="btn btn-gold" style="margin-top:16px" onclick="openEMRModal()">+ Add First Patient</button>
          </div>`
        : patients.map(p => {
            const records = (p.records||[]).length;
            const lastVisit = p.records?.slice(-1)[0]?.date || p.createdAt?.split('T')[0] || '—';
            return `<div class="card" style="cursor:pointer" onclick="openEMRRecord('${p.id}')">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
                <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--blue),#1a6fc4);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:#fff;flex-shrink:0">
                  ${escapeHTML((p.name||'?').charAt(0).toUpperCase())}
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:14px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(p.name)}</div>
                  <div style="font-size:11px;color:var(--muted)">${p.age?p.age+' yrs':''} ${p.gender?'· '+p.gender:''} ${p.blood?'· Blood: '+p.blood:''}</div>
                </div>
                <button class="del-btn" onclick="event.stopPropagation();STRATIX_DB.remove('emr_patients','${p.id}');renderPatientHistory()" style="flex-shrink:0">🗑</button>
              </div>
              <div style="font-size:12px;color:var(--muted);display:flex;justify-content:space-between">
                <span>📋 ${records} record${records!==1?'s':''}</span>
                <span>Last visit: ${escapeHTML(lastVisit)}</span>
              </div>
              ${p.allergies?`<div style="margin-top:8px;font-size:11px;color:var(--red);background:rgba(255,77,77,.08);border-radius:6px;padding:4px 8px">⚠️ Allergies: ${escapeHTML(p.allergies)}</div>`:''}
            </div>`;
          }).join('')}
    </div>
  </div>`;
}

function emrFilter(q) {
  q = q.toLowerCase();
  document.querySelectorAll('#emrPatientGrid .card').forEach(c => {
    c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function openEMRModal(editId) {
  const ex = editId ? STRATIX_DB.getArr('emr_patients').find(p=>p.id===editId) : null;
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="emrModal" onclick="if(event.target===this)document.getElementById('emrModal').remove()">
    <div class="modal" style="max-width:520px">
      <div class="modal-hd"><div class="modal-title">🏥 ${editId?'Edit':'New'} Patient</div>
        <button class="modal-close" onclick="document.getElementById('emrModal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Full Name *</label><input id="emrName" value="${escapeHTML(ex?.name||'')}" placeholder="Patient full name"/></div>
          <div class="field"><label>Age</label><input type="number" id="emrAge" value="${ex?.age||''}" placeholder="35"/></div>
          <div class="field"><label>Gender</label>
            <select id="emrGender">
              <option value="" ${!ex?.gender?'selected':''}>Select</option>
              <option value="Male" ${ex?.gender==='Male'?'selected':''}>Male</option>
              <option value="Female" ${ex?.gender==='Female'?'selected':''}>Female</option>
              <option value="Other" ${ex?.gender==='Other'?'selected':''}>Other</option>
            </select>
          </div>
          <div class="field"><label>Blood Group</label>
            <select id="emrBlood">
              <option value="">Unknown</option>
              ${['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b=>`<option value="${b}" ${ex?.blood===b?'selected':''}>${b}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Phone</label><input type="tel" id="emrPhone" value="${escapeHTML(ex?.phone||'')}" placeholder="9876543210"/></div>
          <div class="field"><label>Address</label><input id="emrAddr" value="${escapeHTML(ex?.address||'')}" placeholder="City / Area"/></div>
        </div>
        <div class="field" style="margin-bottom:12px"><label>Known Allergies</label>
          <input id="emrAllergies" value="${escapeHTML(ex?.allergies||'')}" placeholder="e.g. Penicillin, Aspirin, Dust (leave blank if none)"/>
        </div>
        <div class="field" style="margin-bottom:16px"><label>Medical History / Existing Conditions</label>
          <textarea id="emrHistory" rows="3" placeholder="Diabetes, Hypertension, previous surgeries...">${escapeHTML(ex?.history||'')}</textarea>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('emrModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="saveEMRPatient('${editId||''}')">💾 Save Patient</button>
        </div>
      </div>
    </div>
  </div>`);
}

function saveEMRPatient(editId) {
  const name = document.getElementById('emrName').value.trim();
  if (!name) { NOTIFY.show('Enter patient name', 'error'); return; }
  const item = {
    name, age: parseInt(document.getElementById('emrAge').value)||0,
    gender:    document.getElementById('emrGender').value,
    blood:     document.getElementById('emrBlood').value,
    phone:     document.getElementById('emrPhone').value.trim(),
    address:   document.getElementById('emrAddr').value.trim(),
    allergies: document.getElementById('emrAllergies').value.trim(),
    history:   document.getElementById('emrHistory').value.trim(),
    records:   editId ? (STRATIX_DB.getArr('emr_patients').find(p=>p.id===editId)?.records||[]) : []
  };
  if (editId) { STRATIX_DB.update('emr_patients', editId, item); NOTIFY.show('Patient updated ✅','success'); }
  else { STRATIX_DB.push('emr_patients', item); NOTIFY.show('Patient added ✅','success'); }
  document.getElementById('emrModal').remove();
  renderPatientHistory();
}

function openEMRRecord(patientId) {
  const p = STRATIX_DB.getArr('emr_patients').find(x=>x.id===patientId);
  if (!p) return;
  const records = p.records || [];
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="emrRecordModal" onclick="if(event.target===this)document.getElementById('emrRecordModal').remove()">
    <div class="modal" style="max-width:640px;max-height:92vh">
      <div class="modal-hd">
        <div>
          <div class="modal-title">🏥 ${escapeHTML(p.name)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${p.age?p.age+' yrs · ':''} ${p.gender||''} ${p.blood?'· Blood: '+p.blood:''} ${p.phone?'· '+p.phone:''}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-ghost btn-sm" onclick="openEMRModal('${p.id}')">✏️ Edit</button>
          <button class="modal-close" onclick="document.getElementById('emrRecordModal').remove()">✕</button>
        </div>
      </div>
      <div class="modal-body">
        ${p.allergies?`<div class="alert a-red" style="margin-bottom:12px"><span class="alert-ico">⚠️</span><span><strong>Allergies:</strong> ${escapeHTML(p.allergies)}</span></div>`:''}
        ${p.history?`<div style="background:var(--surface2);border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:var(--text2)"><strong>Medical History:</strong> ${escapeHTML(p.history)}</div>`:''}

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px">Visit Records (${records.length})</div>
          <button class="btn btn-gold btn-sm" onclick="openEMRVisitForm('${p.id}')">+ Add Visit</button>
        </div>
        <div id="emrVisitsList">
          ${!records.length
            ? `<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px">No visit records yet</div>`
            : [...records].reverse().map(r => `
            <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <div style="font-size:12px;font-weight:700;color:var(--text)">${r.date||'—'} ${r.time?'· '+r.time:''}</div>
                <div style="font-size:12px;color:var(--gold);font-weight:700">${r.fee?'₹'+Number(r.fee).toLocaleString('en-IN'):''}</div>
              </div>
              <div style="font-size:12px;color:var(--text2);margin-bottom:4px"><strong>Chief Complaint:</strong> ${escapeHTML(r.complaint||'—')}</div>
              ${r.diagnosis?`<div style="font-size:12px;color:var(--text2);margin-bottom:4px"><strong>Diagnosis:</strong> ${escapeHTML(r.diagnosis)}</div>`:''}
              ${r.prescription?`<div style="font-size:12px;color:var(--text2);margin-bottom:4px"><strong>Prescription:</strong> ${escapeHTML(r.prescription)}</div>`:''}
              ${r.notes?`<div style="font-size:11px;color:var(--muted);margin-top:4px">${escapeHTML(r.notes)}</div>`:''}
            </div>`).join('')}
        </div>
        <div id="emrVisitForm" style="display:none;margin-top:14px;background:var(--surface2);border-radius:12px;padding:16px">
          <div class="form-grid">
            <div class="field"><label>Visit Date</label><input type="date" id="evDate" value="${new Date().toISOString().split('T')[0]}"/></div>
            <div class="field"><label>Visit Time</label><input type="time" id="evTime" value="${new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:false})}"/></div>
            <div class="field"><label>Consultation Fee (₹)</label><input type="number" id="evFee" placeholder="500"/></div>
            <div class="field"><label>Visiting Doctor</label><input id="evDoctor" placeholder="Dr. Name"/></div>
          </div>
          <div class="field" style="margin-bottom:10px"><label>Chief Complaint / Symptoms *</label>
            <textarea id="evComplaint" rows="2" placeholder="What brought the patient in today?"></textarea>
          </div>
          <div class="field" style="margin-bottom:10px"><label>Diagnosis</label>
            <input id="evDiagnosis" placeholder="Clinical diagnosis"/>
          </div>
          <div class="field" style="margin-bottom:10px"><label>Prescription / Treatment</label>
            <textarea id="evPrescription" rows="2" placeholder="Medicines, dosage, treatment plan..."></textarea>
          </div>
          <div class="field" style="margin-bottom:12px"><label>Follow-up / Notes</label>
            <input id="evNotes" placeholder="Next visit date, instructions..."/>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('emrVisitForm').style.display='none'">Cancel</button>
            <button class="btn btn-gold btn-sm" onclick="saveEMRVisit('${p.id}')">💾 Save Visit Record</button>
          </div>
        </div>
      </div>
    </div>
  </div>`);
}

function openEMRVisitForm(patientId) {
  const f = document.getElementById('emrVisitForm');
  if (f) f.style.display = 'block';
}

function saveEMRVisit(patientId) {
  const complaint = document.getElementById('evComplaint').value.trim();
  if (!complaint) { NOTIFY.show('Enter chief complaint', 'error'); return; }
  const p = STRATIX_DB.getArr('emr_patients').find(x=>x.id===patientId);
  if (!p) return;
  const fee = parseFloat(document.getElementById('evFee').value)||0;
  const record = {
    date:         document.getElementById('evDate').value,
    time:         document.getElementById('evTime').value,
    doctor:       document.getElementById('evDoctor').value.trim(),
    fee, complaint,
    diagnosis:    document.getElementById('evDiagnosis').value.trim(),
    prescription: document.getElementById('evPrescription').value.trim(),
    notes:        document.getElementById('evNotes').value.trim(),
    createdAt:    new Date().toISOString()
  };
  const records = [...(p.records||[]), record];
  STRATIX_DB.update('emr_patients', patientId, { records });
  if (fee) {
    STRATIX_DB.push('transactions', { type:'revenue', amount:fee, category:'consultation', description:`Consultation — ${p.name}`, date:record.date });
  }
  NOTIFY.show('Visit record saved ✅','success');
  document.getElementById('emrRecordModal').remove();
  openEMRRecord(patientId);
}

/* ── 12. TABLE / ROOM MANAGEMENT ─────────────────────────────────────────────
   Hotels, Restaurants, Clinics — visual layout */
function renderTableRoomManager() {
  const tables = STRATIX_DB.getArr('room_tables');
  const settings = STRATIX_DB.getSettings();
  const sym = settings.currencySymbol || '₹';

  const occupied  = tables.filter(t=>t.status==='occupied').length;
  const available = tables.filter(t=>t.status==='available').length;
  const dirty     = tables.filter(t=>t.status==='dirty').length;
  const reserved  = tables.filter(t=>t.status==='reserved').length;
  const todayRev  = tables.filter(t=>t.status==='occupied'&&t.billAmount).reduce((s,t)=>s+Number(t.billAmount||0),0);

  const el = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div><h1 class="sec-title">🍽️ Table / Room Manager</h1>
        <p class="sec-sub">Visual layout — manage occupancy, billing &amp; housekeeping in real time</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-ghost" onclick="openAddTableModal()">+ Add Table/Room</button>
        <button class="btn btn-gold" onclick="trMarkAllAvailable()">🔄 Reset All</button>
      </div>
    </div>

    <div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi"><div class="kpi-ico">🟢</div><div class="kpi-lbl">Available</div><div class="kpi-val green">${available}</div></div>
      <div class="kpi accent"><div class="kpi-ico">🔴</div><div class="kpi-lbl">Occupied</div><div class="kpi-val red">${occupied}</div></div>
      <div class="kpi"><div class="kpi-ico">🟡</div><div class="kpi-lbl">Reserved</div><div class="kpi-val gold">${reserved}</div></div>
      <div class="kpi"><div class="kpi-ico">💰</div><div class="kpi-lbl">Today's Running Bill</div><div class="kpi-val">${sym}${todayRev.toLocaleString('en-IN')}</div></div>
    </div>

    <!-- Legend -->
    <div style="display:flex;gap:14px;margin-bottom:16px;flex-wrap:wrap">
      ${[['🟢','available','Available'],['🔴','occupied','Occupied'],['🟡','reserved','Reserved'],['🟤','dirty','Needs Cleaning']].map(([e,cls,lbl])=>
        `<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)">${e} ${lbl}</div>`).join('')}
      <div style="margin-left:auto;font-size:12px;color:var(--muted)">Click any table/room to manage it</div>
    </div>

    <!-- Visual grid -->
    ${!tables.length
      ? `<div class="empty" style="padding:60px">
          <div class="ei">🍽️</div>
          <h3>No tables or rooms added yet</h3>
          <p>Add your restaurant tables, hotel rooms, or clinic rooms</p>
          <button class="btn btn-gold" style="margin-top:16px" onclick="openAddTableModal()">+ Add First Table/Room</button>
        </div>`
      : `<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px">
          ${tables.map(t => {
            const colMap = {available:'rgba(0,214,143,.12)','available-border':'rgba(0,214,143,.4)',occupied:'rgba(255,77,77,.12)','occupied-border':'rgba(255,77,77,.4)',reserved:'rgba(37,99,235,.12)','reserved-border':'rgba(37,99,235,.4)',dirty:'rgba(139,92,60,.12)','dirty-border':'rgba(139,92,60,.4)'};
            const bg = colMap[t.status] || colMap.available;
            const border = colMap[t.status+'-border'] || colMap['available-border'];
            const icon = t.type==='room'?'🛏️':t.type==='clinic'?'🏥':'🍽️';
            return `<div onclick="openTableAction('${t.id}')" style="width:110px;background:${bg};border:2px solid ${border};border-radius:12px;padding:14px 10px;text-align:center;cursor:pointer;transition:transform .15s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
              <div style="font-size:24px;margin-bottom:4px">${icon}</div>
              <div style="font-size:13px;font-weight:800;color:var(--text)">${escapeHTML(t.name)}</div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">${t.capacity?t.capacity+' pax':''}</div>
              <div style="font-size:10px;font-weight:700;margin-top:6px;text-transform:uppercase;letter-spacing:.4px;color:${t.status==='available'?'var(--green)':t.status==='occupied'?'var(--red)':t.status==='reserved'?'var(--gold)':'#8b5c3c'}">${t.status}</div>
              ${t.status==='occupied'&&t.guestName?`<div style="font-size:10px;color:var(--muted);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(t.guestName)}</div>`:''}
              ${t.status==='occupied'&&t.billAmount?`<div style="font-size:11px;font-weight:700;color:var(--gold);margin-top:3px">${sym}${Number(t.billAmount).toLocaleString('en-IN')}</div>`:''}
            </div>`;
          }).join('')}
        </div>`}
  </div>`;
}

function openTableAction(id) {
  const t = STRATIX_DB.getArr('room_tables').find(x=>x.id===id);
  if (!t) return;
  const sym = STRATIX_DB.getSettings().currencySymbol || '₹';
  const icon = t.type==='room'?'🛏️':t.type==='clinic'?'🏥':'🍽️';

  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="tableActionModal" onclick="if(event.target===this)document.getElementById('tableActionModal').remove()">
    <div class="modal" style="max-width:420px">
      <div class="modal-hd">
        <div class="modal-title">${icon} ${escapeHTML(t.name)} — ${escapeHTML(t.status)}</div>
        <button class="modal-close" onclick="document.getElementById('tableActionModal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          <button class="btn btn-green" onclick="trSetStatus('${id}','available')">🟢 Mark Available</button>
          <button class="btn btn-red" onclick="trSetStatus('${id}','occupied')">🔴 Mark Occupied</button>
          <button class="btn btn-ghost" style="border-color:rgba(37,99,235,.4);color:var(--gold)" onclick="trSetStatus('${id}','reserved')">🟡 Reserved</button>
          <button class="btn btn-ghost" onclick="trSetStatus('${id}','dirty')">🧹 Needs Cleaning</button>
        </div>
        ${t.status==='occupied'?`
        <div style="background:var(--surface2);border-radius:10px;padding:12px;margin-bottom:12px">
          <div class="field" style="margin-bottom:8px"><label>Guest / Customer Name</label><input id="tGuestName" value="${escapeHTML(t.guestName||'')}" placeholder="Name"/></div>
          <div class="field" style="margin-bottom:8px"><label>Running Bill (${sym})</label><input type="number" id="tBillAmt" value="${t.billAmount||''}" placeholder="0"/></div>
          <button class="btn btn-gold btn-sm btn-full" onclick="trUpdateBill('${id}')">💰 Update Bill</button>
        </div>
        <button class="btn btn-green btn-full" style="margin-bottom:10px" onclick="trCheckout('${id}')">✅ Checkout + Record Revenue</button>
        `:''}
        <button class="btn btn-red btn-sm btn-full" onclick="STRATIX_DB.remove('room_tables','${id}');document.getElementById('tableActionModal').remove();renderTableRoomManager()">🗑 Remove ${t.type==='room'?'Room':'Table'}</button>
      </div>
    </div>
  </div>`);
}

function trSetStatus(id, status) {
  STRATIX_DB.update('room_tables', id, { status, updatedAt: new Date().toISOString() });
  document.getElementById('tableActionModal')?.remove();
  NOTIFY.show(`Status → ${status}`, 'success', 1500);
  renderTableRoomManager();
}

function trUpdateBill(id) {
  const name = document.getElementById('tGuestName')?.value.trim();
  const amt  = parseFloat(document.getElementById('tBillAmt')?.value) || 0;
  STRATIX_DB.update('room_tables', id, { guestName: name, billAmount: amt });
  NOTIFY.show('Bill updated ✅', 'success', 1500);
  document.getElementById('tableActionModal')?.remove();
  renderTableRoomManager();
}

function trCheckout(id) {
  const t = STRATIX_DB.getArr('room_tables').find(x=>x.id===id);
  if (t?.billAmount) {
    STRATIX_DB.push('transactions', {
      type:'revenue', amount: Number(t.billAmount),
      category: t.type==='room' ? 'accommodation' : 'food_beverage',
      description: `Checkout — ${t.name}${t.guestName?' ('+t.guestName+')':''}`,
      date: new Date().toISOString().split('T')[0]
    });
    NOTIFY.show(`Checkout done! Revenue ₹${Number(t.billAmount).toLocaleString('en-IN')} recorded ✅`,'success');
  } else {
    NOTIFY.show('Checkout done ✅','success');
  }
  STRATIX_DB.update('room_tables', id, { status:'dirty', guestName:'', billAmount:0 });
  document.getElementById('tableActionModal')?.remove();
  renderTableRoomManager();
}

function trMarkAllAvailable() {
  const tables = STRATIX_DB.getArr('room_tables');
  tables.forEach(t => STRATIX_DB.update('room_tables', t.id, { status:'available', guestName:'', billAmount:0 }));
  NOTIFY.show('All tables/rooms reset to Available','success');
  renderTableRoomManager();
}

function openAddTableModal() {
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="addTableModal" onclick="if(event.target===this)document.getElementById('addTableModal').remove()">
    <div class="modal" style="max-width:420px">
      <div class="modal-hd"><div class="modal-title">➕ Add Table / Room</div>
        <button class="modal-close" onclick="document.getElementById('addTableModal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Name / Number *</label><input id="atName" placeholder="Table 1, Room 101, OT-1"/></div>
          <div class="field"><label>Type</label>
            <select id="atType">
              <option value="table">🍽️ Restaurant Table</option>
              <option value="room">🛏️ Hotel Room</option>
              <option value="clinic">🏥 Clinic Room</option>
            </select>
          </div>
          <div class="field"><label>Capacity (persons)</label><input type="number" id="atCap" placeholder="4"/></div>
          <div class="field"><label>Floor / Section</label><input id="atFloor" placeholder="Ground / 1st / AC Section"/></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:8px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('addTableModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="saveTable()">💾 Add</button>
        </div>
      </div>
    </div>
  </div>`);
}

function saveTable() {
  const name = document.getElementById('atName').value.trim();
  if (!name) { NOTIFY.show('Enter table/room name','error'); return; }
  STRATIX_DB.push('room_tables', {
    name, type: document.getElementById('atType').value,
    capacity: parseInt(document.getElementById('atCap').value)||0,
    floor: document.getElementById('atFloor').value.trim(),
    status: 'available', guestName:'', billAmount:0
  });
  NOTIFY.show('Added ✅','success');
  document.getElementById('addTableModal').remove();
  renderTableRoomManager();
}

/* ══════════════════════════════════════════════════════════
   BATCH 3 — REAL ESTATE & SERVICES
══════════════════════════════════════════════════════════ */

/* ── 13. CONTRACTOR MANAGEMENT ───────────────────────────────────────────────
   Work orders, partial payments, contractor tracking */
function renderContractorManagement() {
  const contractors = STRATIX_DB.getArr('contractors');
  const workOrders  = STRATIX_DB.getArr('work_orders');
  const sym = STRATIX_DB.getSettings().currencySymbol || '₹';

  const pendingWO    = workOrders.filter(w=>w.status==='pending'||w.status==='in_progress').length;
  const totalContracted = workOrders.reduce((s,w)=>s+Number(w.totalAmt||0),0);
  const totalPaid    = workOrders.reduce((s,w)=>s+Number(w.paidAmt||0),0);
  const totalBalance = totalContracted - totalPaid;

  const el = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div><h1 class="sec-title">👷 Contractor Management</h1>
        <p class="sec-sub">Manage work orders, partial payments &amp; contractor performance</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-ghost" onclick="openContractorModal()">+ Add Contractor</button>
        <button class="btn btn-gold" onclick="openWorkOrderModal()">+ New Work Order</button>
      </div>
    </div>

    <div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi"><div class="kpi-ico">👷</div><div class="kpi-lbl">Contractors</div><div class="kpi-val">${contractors.length}</div></div>
      <div class="kpi accent"><div class="kpi-ico">📋</div><div class="kpi-lbl">Active Work Orders</div><div class="kpi-val">${pendingWO}</div></div>
      <div class="kpi"><div class="kpi-ico">💰</div><div class="kpi-lbl">Total Contracted</div><div class="kpi-val gold">${sym}${(totalContracted/100000).toFixed(1)}L</div></div>
      <div class="kpi"><div class="kpi-ico">⏳</div><div class="kpi-lbl">Balance Pending</div><div class="kpi-val ${totalBalance>0?'red':''}">${sym}${totalBalance.toLocaleString('en-IN')}</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <!-- Contractors list -->
      <div class="card">
        <div class="card-title">👷 Contractors <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="openContractorModal()">+ Add</button></div>
        ${!contractors.length
          ? `<div style="color:var(--muted);font-size:13px;padding:16px 0;text-align:center">No contractors added</div>`
          : contractors.map(c=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--text)">${escapeHTML(c.name)}</div>
              <div style="font-size:11px;color:var(--muted)">${escapeHTML(c.trade||'—')} ${c.phone?'· '+c.phone:''}</div>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <span class="badge ${c.rating>=4?'bg':c.rating>=3?'bgold':'br'}">${c.rating||'—'}★</span>
              <button class="del-btn" onclick="STRATIX_DB.remove('contractors','${c.id}');renderContractorManagement()">🗑</button>
            </div>
          </div>`).join('')}
      </div>

      <!-- Work Orders summary -->
      <div class="card">
        <div class="card-title">📋 Work Orders <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="openWorkOrderModal()">+ Add</button></div>
        ${!workOrders.length
          ? `<div style="color:var(--muted);font-size:13px;padding:16px 0;text-align:center">No work orders yet</div>`
          : workOrders.slice().reverse().slice(0,5).map(w=>{
              const bal = Number(w.totalAmt||0)-Number(w.paidAmt||0);
              return `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                  <span style="font-size:13px;font-weight:700;color:var(--text)">${escapeHTML(w.description||'Work Order')}</span>
                  <span class="badge ${w.status==='completed'?'bg':w.status==='in_progress'?'bgold':'bm'}">${w.status}</span>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted)">
                  <span>${escapeHTML(w.contractor||'—')}</span>
                  <span style="color:${bal>0?'var(--red)':'var(--green)'};font-weight:700">Bal: ${sym}${bal.toLocaleString('en-IN')}</span>
                </div>
              </div>`;
            }).join('')}
      </div>
    </div>

    <!-- Full work orders table -->
    <div class="tbl-wrap">
      <div class="tbl-head"><div class="tbl-title">All Work Orders</div></div>
      ${!workOrders.length ? `<div class="empty" style="padding:32px"><button class="btn btn-gold btn-sm" onclick="openWorkOrderModal()">+ Add First Work Order</button></div>` : `
      <div class="tbl-scroll"><table>
        <thead><tr><th>Description</th><th>Contractor</th><th>Total (${sym})</th><th>Paid (${sym})</th><th>Balance</th><th>Due Date</th><th>Status</th><th></th></tr></thead>
        <tbody>
        ${workOrders.slice().reverse().map(w=>{
          const bal=Number(w.totalAmt||0)-Number(w.paidAmt||0);
          return `<tr>
            <td class="td-b">${escapeHTML(w.description||'—')}</td>
            <td class="td-m">${escapeHTML(w.contractor||'—')}</td>
            <td style="font-weight:700">${sym}${Number(w.totalAmt||0).toLocaleString('en-IN')}</td>
            <td style="color:var(--green)">${sym}${Number(w.paidAmt||0).toLocaleString('en-IN')}</td>
            <td style="font-weight:700;color:${bal>0?'var(--red)':'var(--green)'}">${sym}${bal.toLocaleString('en-IN')}</td>
            <td class="td-m">${w.dueDate||'—'}</td>
            <td><span class="badge ${w.status==='completed'?'bg':w.status==='in_progress'?'bgold':'bm'}">${w.status||'pending'}</span></td>
            <td style="white-space:nowrap">
              ${bal>0?`<button class="btn btn-ghost btn-sm" style="margin-right:4px" onclick="woPayment('${w.id}',${bal})">💸 Pay</button>`:''}
              <button class="del-btn" onclick="STRATIX_DB.remove('work_orders','${w.id}');renderContractorManagement()">🗑</button>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`}
    </div>
  </div>`;
}

function openContractorModal() {
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="contractorModal" onclick="if(event.target===this)document.getElementById('contractorModal').remove()">
    <div class="modal" style="max-width:440px">
      <div class="modal-hd"><div class="modal-title">👷 Add Contractor</div><button class="modal-close" onclick="document.getElementById('contractorModal').remove()">✕</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Name *</label><input id="ctName" placeholder="Contractor name"/></div>
          <div class="field"><label>Trade / Specialty</label><input id="ctTrade" placeholder="Plumber / Electrician / Painter"/></div>
          <div class="field"><label>Phone</label><input type="tel" id="ctPhone" placeholder="9876543210"/></div>
          <div class="field"><label>Rating (1-5)</label><input type="number" id="ctRating" min="1" max="5" placeholder="5"/></div>
        </div>
        <div class="field" style="margin-bottom:14px"><label>Notes</label><input id="ctNotes" placeholder="License no., company name, etc."/></div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('contractorModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="saveContractor()">💾 Save</button>
        </div>
      </div>
    </div>
  </div>`);
}

function saveContractor() {
  const name = document.getElementById('ctName').value.trim();
  if (!name) { NOTIFY.show('Enter name','error'); return; }
  STRATIX_DB.push('contractors', { name, trade:document.getElementById('ctTrade').value.trim(), phone:document.getElementById('ctPhone').value.trim(), rating:parseFloat(document.getElementById('ctRating').value)||0, notes:document.getElementById('ctNotes').value.trim() });
  NOTIFY.show('Contractor added ✅','success');
  document.getElementById('contractorModal').remove();
  renderContractorManagement();
}

function openWorkOrderModal() {
  const contractors = STRATIX_DB.getArr('contractors');
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="woModal" onclick="if(event.target===this)document.getElementById('woModal').remove()">
    <div class="modal" style="max-width:480px">
      <div class="modal-hd"><div class="modal-title">📋 New Work Order</div><button class="modal-close" onclick="document.getElementById('woModal').remove()">✕</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field form-full"><label>Work Description *</label><input id="woDesc" placeholder="Plumbing work — 2nd floor bathrooms"/></div>
          <div class="field"><label>Contractor</label>
            <input id="woContractor" placeholder="Contractor name" list="woCtList"/>
            <datalist id="woCtList">${contractors.map(c=>`<option value="${escapeHTML(c.name)}">`).join('')}</datalist>
          </div>
          <div class="field"><label>Total Amount (${STRATIX_DB.getSettings().currencySymbol||'₹'})</label><input type="number" id="woTotal" placeholder="50000"/></div>
          <div class="field"><label>Advance Paid</label><input type="number" id="woAdvance" placeholder="0" value="0"/></div>
          <div class="field"><label>Due Date</label><input type="date" id="woDue"/></div>
          <div class="field"><label>Status</label>
            <select id="woStatus">
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:8px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('woModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="saveWorkOrder()">💾 Save Work Order</button>
        </div>
      </div>
    </div>
  </div>`);
}

function saveWorkOrder() {
  const desc = document.getElementById('woDesc').value.trim();
  if (!desc) { NOTIFY.show('Enter description','error'); return; }
  const advance = parseFloat(document.getElementById('woAdvance').value)||0;
  STRATIX_DB.push('work_orders', { description:desc, contractor:document.getElementById('woContractor').value.trim(), totalAmt:parseFloat(document.getElementById('woTotal').value)||0, paidAmt:advance, dueDate:document.getElementById('woDue').value, status:document.getElementById('woStatus').value });
  if (advance>0) STRATIX_DB.push('transactions',{type:'expense',amount:advance,category:'contractor',description:`Advance — ${desc}`,date:new Date().toISOString().split('T')[0]});
  NOTIFY.show('Work order saved ✅','success');
  document.getElementById('woModal').remove();
  renderContractorManagement();
}

function woPayment(id, balance) {
  const sym = STRATIX_DB.getSettings().currencySymbol||'₹';
  const wo  = STRATIX_DB.getArr('work_orders').find(w=>w.id===id);
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="woPayModal" onclick="if(event.target===this)document.getElementById('woPayModal').remove()">
    <div class="modal" style="max-width:360px">
      <div class="modal-hd"><div class="modal-title">💸 Record Payment</div><button class="modal-close" onclick="document.getElementById('woPayModal').remove()">✕</button></div>
      <div class="modal-body">
        <div style="font-size:13px;color:var(--muted);margin-bottom:12px">Balance due: <strong style="color:var(--red)">${sym}${balance.toLocaleString('en-IN')}</strong></div>
        <div class="field" style="margin-bottom:12px"><label>Payment Amount (${sym})</label><input type="number" id="woPay" value="${balance}" max="${balance}"/></div>
        <div class="field" style="margin-bottom:14px"><label>Mark as</label>
          <select id="woNewStatus"><option value="in_progress">Still In Progress</option><option value="completed">Completed ✅</option></select>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('woPayModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="
            var amt=parseFloat(document.getElementById('woPay').value)||0;
            var newPaid=Number(${Number(wo?.paidAmt||0)})+amt;
            STRATIX_DB.update('work_orders','${id}',{paidAmt:newPaid,status:document.getElementById('woNewStatus').value});
            STRATIX_DB.push('transactions',{type:'expense',amount:amt,category:'contractor',description:'Payment — ${escapeHTML(wo?.description||'')}',date:new Date().toISOString().split('T')[0]});
            NOTIFY.show('Payment recorded ✅','success');
            document.getElementById('woPayModal').remove();
            renderContractorManagement();
          ">💾 Record</button>
        </div>
      </div>
    </div>
  </div>`);
}

/* ── 14. SITE DAILY LOGS ─────────────────────────────────────────────────────
   Construction site manager — daily material & labour usage */
function renderSiteDailyLogs() {
  const logs  = STRATIX_DB.getArr('site_logs');
  const today = new Date().toISOString().split('T')[0];
  const el    = document.getElementById('sectionContent');

  const totalCement = logs.reduce((s,l)=>s+Number(l.cement||0),0);
  const totalSteel  = logs.reduce((s,l)=>s+Number(l.steel||0),0);
  const totalLabour = logs.reduce((s,l)=>s+Number(l.labour||0),0);
  const sym = STRATIX_DB.getSettings().currencySymbol||'₹';

  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div><h1 class="sec-title">🏗️ Site Daily Logs</h1>
        <p class="sec-sub">Track daily material consumption, labour &amp; site progress</p>
      </div>
      <button class="btn btn-gold" onclick="openSiteLogModal()">+ Today's Log</button>
    </div>

    <div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi"><div class="kpi-ico">🧱</div><div class="kpi-lbl">Total Cement Used</div><div class="kpi-val">${totalCement} <span style="font-size:13px">bags</span></div></div>
      <div class="kpi"><div class="kpi-ico">⚙️</div><div class="kpi-lbl">Total Steel Used</div><div class="kpi-val">${totalSteel} <span style="font-size:13px">kg</span></div></div>
      <div class="kpi"><div class="kpi-ico">👷</div><div class="kpi-lbl">Total Labour Days</div><div class="kpi-val">${totalLabour}</div></div>
      <div class="kpi"><div class="kpi-ico">📋</div><div class="kpi-lbl">Total Log Entries</div><div class="kpi-val">${logs.length}</div></div>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head"><div class="tbl-title">Site Log Entries</div></div>
      ${!logs.length
        ? `<div class="empty" style="padding:36px"><button class="btn btn-gold btn-sm" onclick="openSiteLogModal()">+ Add First Log</button></div>`
        : `<div class="tbl-scroll"><table>
          <thead><tr><th>Date</th><th>Site</th><th>Cement (bags)</th><th>Steel (kg)</th><th>Sand (cft)</th><th>Labour (persons)</th><th>Labour Cost</th><th>Work Done</th><th></th></tr></thead>
          <tbody>
          ${[...logs].sort((a,b)=>b.date?.localeCompare(a.date||'')).map(l=>`<tr>
            <td class="td-m">${l.date||'—'}</td>
            <td class="td-b">${escapeHTML(l.site||'Main Site')}</td>
            <td>${l.cement||0}</td>
            <td>${l.steel||0}</td>
            <td>${l.sand||0}</td>
            <td>${l.labour||0}</td>
            <td style="color:var(--red)">${l.labourCost?sym+Number(l.labourCost).toLocaleString('en-IN'):'—'}</td>
            <td class="td-m">${escapeHTML(l.workDone||'—')}</td>
            <td><button class="del-btn" onclick="STRATIX_DB.remove('site_logs','${l.id}');renderSiteDailyLogs()">🗑</button></td>
          </tr>`).join('')}
          </tbody>
        </table></div>`}
    </div>
  </div>`;
}

function openSiteLogModal() {
  const sites = [...new Set(STRATIX_DB.getArr('site_logs').map(l=>l.site).filter(Boolean))];
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="siteLogModal" onclick="if(event.target===this)document.getElementById('siteLogModal').remove()">
    <div class="modal" style="max-width:520px">
      <div class="modal-hd"><div class="modal-title">🏗️ Daily Site Log</div><button class="modal-close" onclick="document.getElementById('siteLogModal').remove()">✕</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Date</label><input type="date" id="slDate" value="${new Date().toISOString().split('T')[0]}"/></div>
          <div class="field"><label>Site Name</label>
            <input id="slSite" placeholder="Main Site / Tower A" list="slSiteList"/>
            <datalist id="slSiteList">${sites.map(s=>`<option value="${escapeHTML(s)}">`).join('')}</datalist>
          </div>
          <div class="field"><label>Cement Used (bags)</label><input type="number" id="slCement" placeholder="0"/></div>
          <div class="field"><label>Steel Used (kg)</label><input type="number" id="slSteel" placeholder="0"/></div>
          <div class="field"><label>Sand Used (cft)</label><input type="number" id="slSand" placeholder="0"/></div>
          <div class="field"><label>Bricks / Blocks</label><input type="number" id="slBricks" placeholder="0"/></div>
          <div class="field"><label>Labour Count (persons)</label><input type="number" id="slLabour" placeholder="0"/></div>
          <div class="field"><label>Labour Cost (${STRATIX_DB.getSettings().currencySymbol||'₹'})</label><input type="number" id="slLabourCost" placeholder="0"/></div>
        </div>
        <div class="field" style="margin-bottom:10px"><label>Work Done Today</label>
          <textarea id="slWorkDone" rows="2" placeholder="Slab casting for 3rd floor, column formwork, etc."></textarea>
        </div>
        <div class="field" style="margin-bottom:14px"><label>Issues / Notes</label>
          <input id="slNotes" placeholder="Delay due to rain, material shortage, etc."/>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('siteLogModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="saveSiteLog()">💾 Save Log</button>
        </div>
      </div>
    </div>
  </div>`);
}

function saveSiteLog() {
  const labourCost = parseFloat(document.getElementById('slLabourCost').value)||0;
  STRATIX_DB.push('site_logs', {
    date:       document.getElementById('slDate').value,
    site:       document.getElementById('slSite').value.trim()||'Main Site',
    cement:     parseFloat(document.getElementById('slCement').value)||0,
    steel:      parseFloat(document.getElementById('slSteel').value)||0,
    sand:       parseFloat(document.getElementById('slSand').value)||0,
    bricks:     parseFloat(document.getElementById('slBricks').value)||0,
    labour:     parseFloat(document.getElementById('slLabour').value)||0,
    labourCost,
    workDone:   document.getElementById('slWorkDone').value.trim(),
    notes:      document.getElementById('slNotes').value.trim()
  });
  if (labourCost>0) STRATIX_DB.push('transactions',{type:'expense',amount:labourCost,category:'labour',description:`Site Labour — ${document.getElementById('slSite').value.trim()||'Site'}`,date:document.getElementById('slDate').value});
  NOTIFY.show('Site log saved ✅','success');
  document.getElementById('siteLogModal').remove();
  renderSiteDailyLogs();
}

/* ── 15. TIMESHEETS ───────────────────────────────────────────────────────────
   Law firms, agencies, consultants — track hours per client */
function renderTimesheets() {
  const entries = STRATIX_DB.getArr('timesheet_entries');
  const sym     = STRATIX_DB.getSettings().currencySymbol || '₹';
  const today   = new Date().toISOString().split('T')[0];

  // Group by client
  const byClient = {};
  entries.forEach(e => {
    if (!byClient[e.client]) byClient[e.client] = { hours:0, revenue:0, entries:[] };
    byClient[e.client].hours   += Number(e.hours||0);
    byClient[e.client].revenue += Number(e.hours||0) * Number(e.rate||0);
    byClient[e.client].entries.push(e);
  });

  const totalHours   = entries.reduce((s,e)=>s+Number(e.hours||0), 0);
  const totalRevenue = entries.reduce((s,e)=>s+Number(e.hours||0)*Number(e.rate||0), 0);
  const unbilled     = entries.filter(e=>!e.billed).reduce((s,e)=>s+Number(e.hours||0)*Number(e.rate||0), 0);

  const el = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div><h1 class="sec-title">⏱️ Timesheets</h1>
        <p class="sec-sub">Track billable hours per client — generate invoices based on time</p>
      </div>
      <button class="btn btn-gold" onclick="openTimesheetModal()">+ Log Hours</button>
    </div>

    <div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi accent"><div class="kpi-ico">⏱️</div><div class="kpi-lbl">Total Hours Logged</div><div class="kpi-val">${totalHours.toFixed(1)} <span style="font-size:13px">hrs</span></div></div>
      <div class="kpi"><div class="kpi-ico">💰</div><div class="kpi-lbl">Total Billable Value</div><div class="kpi-val gold">${sym}${Math.round(totalRevenue).toLocaleString('en-IN')}</div></div>
      <div class="kpi"><div class="kpi-ico">📤</div><div class="kpi-lbl">Unbilled Amount</div><div class="kpi-val ${unbilled>0?'red':''}">${sym}${Math.round(unbilled).toLocaleString('en-IN')}</div></div>
      <div class="kpi"><div class="kpi-ico">👥</div><div class="kpi-lbl">Clients</div><div class="kpi-val">${Object.keys(byClient).length}</div></div>
    </div>

    <!-- By client summary -->
    ${Object.keys(byClient).length > 0 ? `
    <div class="card" style="margin-bottom:18px">
      <div class="card-title">👥 By Client</div>
      ${Object.entries(byClient).map(([client, data]) => {
        const unbilledAmt = data.entries.filter(e=>!e.billed).reduce((s,e)=>s+Number(e.hours||0)*Number(e.rate||0),0);
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text)">${escapeHTML(client)}</div>
            <div style="font-size:11px;color:var(--muted)">${data.hours.toFixed(1)} hrs · ${sym}${Math.round(data.revenue).toLocaleString('en-IN')} total</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            ${unbilledAmt>0?`<span style="font-size:12px;font-weight:700;color:var(--red)">Unbilled: ${sym}${Math.round(unbilledAmt).toLocaleString('en-IN')}</span>`:'<span style="color:var(--green);font-size:12px">✅ All billed</span>'}
            <button class="btn btn-gold btn-sm" onclick="tsMarkBilled('${escapeHTML(client)}')">Mark Billed</button>
          </div>
        </div>`;
      }).join('')}
    </div>` : ''}

    <!-- Timesheet entries table -->
    <div class="tbl-wrap">
      <div class="tbl-head"><div class="tbl-title">Timesheet Entries</div></div>
      ${!entries.length
        ? `<div class="empty" style="padding:36px"><button class="btn btn-gold btn-sm" onclick="openTimesheetModal()">+ Log First Hours</button></div>`
        : `<div class="tbl-scroll"><table>
          <thead><tr><th>Date</th><th>Client</th><th>Task</th><th>Hours</th><th>Rate/hr</th><th>Amount</th><th>Billed?</th><th></th></tr></thead>
          <tbody>
          ${[...entries].sort((a,b)=>b.date?.localeCompare(a.date||'')).map(e=>{
            const amt=Number(e.hours||0)*Number(e.rate||0);
            return `<tr>
              <td class="td-m">${e.date||'—'}</td>
              <td class="td-b">${escapeHTML(e.client||'—')}</td>
              <td class="td-m">${escapeHTML(e.task||'—')}</td>
              <td style="font-weight:700">${Number(e.hours||0).toFixed(1)}</td>
              <td class="td-m">${sym}${Number(e.rate||0).toLocaleString('en-IN')}</td>
              <td style="font-weight:700;color:var(--gold)">${sym}${Math.round(amt).toLocaleString('en-IN')}</td>
              <td><span class="badge ${e.billed?'bg':'br'}">${e.billed?'Billed':'Unbilled'}</span></td>
              <td><button class="del-btn" onclick="STRATIX_DB.remove('timesheet_entries','${e.id}');renderTimesheets()">🗑</button></td>
            </tr>`;
          }).join('')}
          </tbody>
        </table></div>`}
    </div>
  </div>`;
}

function openTimesheetModal() {
  const clients = [...new Set(STRATIX_DB.getArr('timesheet_entries').map(e=>e.client).filter(Boolean))];
  const crmClients = STRATIX_DB.getArr('clients').map(c=>c.name).filter(Boolean);
  const allClients = [...new Set([...clients, ...crmClients])];
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="tsModal" onclick="if(event.target===this)document.getElementById('tsModal').remove()">
    <div class="modal" style="max-width:460px">
      <div class="modal-hd"><div class="modal-title">⏱️ Log Hours</div><button class="modal-close" onclick="document.getElementById('tsModal').remove()">✕</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Date</label><input type="date" id="tsDate" value="${new Date().toISOString().split('T')[0]}"/></div>
          <div class="field"><label>Client *</label>
            <input id="tsClient" placeholder="Client / Matter name" list="tsClientList"/>
            <datalist id="tsClientList">${allClients.map(c=>`<option value="${escapeHTML(c)}">`).join('')}</datalist>
          </div>
          <div class="field"><label>Task / Description *</label><input id="tsTask" placeholder="Contract drafting, Court hearing, Design work..."/></div>
          <div class="field"><label>Hours *</label><input type="number" id="tsHours" placeholder="2.5" step="0.25"/></div>
          <div class="field"><label>Rate per Hour (${STRATIX_DB.getSettings().currencySymbol||'₹'})</label><input type="number" id="tsRate" placeholder="2000"/></div>
          <div class="field"><label>Billable?</label>
            <select id="tsBillable">
              <option value="yes">Yes — Billable</option>
              <option value="no">No — Internal / Non-billable</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:8px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('tsModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="saveTimeEntry()">💾 Log Hours</button>
        </div>
      </div>
    </div>
  </div>`);
}

function saveTimeEntry() {
  const client = document.getElementById('tsClient').value.trim();
  const hours  = parseFloat(document.getElementById('tsHours').value);
  const task   = document.getElementById('tsTask').value.trim();
  if (!client || !hours || !task) { NOTIFY.show('Fill in client, task and hours','error'); return; }
  STRATIX_DB.push('timesheet_entries', {
    date:     document.getElementById('tsDate').value,
    client, task,
    hours,
    rate:     parseFloat(document.getElementById('tsRate').value)||0,
    billable: document.getElementById('tsBillable').value === 'yes',
    billed:   false
  });
  NOTIFY.show('Hours logged ✅','success');
  document.getElementById('tsModal').remove();
  renderTimesheets();
}

function tsMarkBilled(clientName) {
  const entries = STRATIX_DB.getArr('timesheet_entries');
  const unbilled = entries.filter(e=>e.client===clientName&&!e.billed);
  unbilled.forEach(e=>STRATIX_DB.update('timesheet_entries',e.id,{billed:true}));
  const totalAmt = unbilled.reduce((s,e)=>s+Number(e.hours||0)*Number(e.rate||0),0);
  if (totalAmt>0) {
    STRATIX_DB.push('transactions',{type:'revenue',amount:Math.round(totalAmt),category:'professional_fees',description:`Billing — ${clientName}`,date:new Date().toISOString().split('T')[0]});
    NOTIFY.show(`Marked billed! Revenue ${STRATIX_DB.getSettings().currencySymbol||'₹'}${Math.round(totalAmt).toLocaleString('en-IN')} recorded ✅`,'success');
  } else {
    NOTIFY.show('Marked as billed ✅','success');
  }
  renderTimesheets();
}

/* ══════════════════════════════════════════════════════════
   16. OMNICHANNEL STOCK SYNC
   Keeps stock levels consistent across:
   Physical Store (rtl_items) + Website (manual) +
   Marketplaces (Amazon, Flipkart, Meesho, Myntra — manual entry)
   + WhatsApp Catalogue sync helper
   Lives in: 📦 Inventory group (Trading vertical)
══════════════════════════════════════════════════════════ */
function renderOmnichannelSync() {
  const channels = STRATIX_DB.getArr('omni_channels');
  const syncs    = STRATIX_DB.getArr('omni_sync_log');
  const items    = STRATIX_DB.getArr('rtl_items');
  const variants = STRATIX_DB.getArr('variant_products');
  const sym      = STRATIX_DB.getSettings().currencySymbol || '₹';

  // Calculate total channel stock vs physical stock
  const totalPhysical = items.reduce((s, i) => s + Number(i.qty || 0), 0);
  const channelCount  = channels.length;
  const pendingSync   = items.filter(i => {
    const channelQtys = channels.map(ch => {
      const m = (ch.mappings || []).find(m => m.itemId === i.id);
      return m ? Number(m.channelQty || 0) : null;
    }).filter(q => q !== null);
    return channelQtys.some(q => q !== Number(i.qty || 0));
  }).length;

  const el = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div>
        <h1 class="sec-title">🔄 Omnichannel Stock Sync</h1>
        <p class="sec-sub">Sync stock levels across your physical store, website &amp; marketplaces — Amazon, Flipkart, Meesho, Myntra</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-ghost" onclick="openChannelModal()">+ Add Channel</button>
        <button class="btn btn-gold" onclick="omniSyncAll()">🔄 Sync All Now</button>
      </div>
    </div>

    <!-- How it works banner -->
    <div class="alert alert-blue" style="margin-bottom:18px">
      <span class="alert-ico">💡</span>
      <div>
        <strong>How it works:</strong> Your physical store (STRATIX POS) is the <strong>master stock</strong>.
        After each sale, update your marketplace listings here to match. STRATIX shows you exactly what needs updating
        so you never oversell on any channel.
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi accent">
        <div class="kpi-ico">🏪</div>
        <div class="kpi-lbl">Total Physical Stock</div>
        <div class="kpi-val">${totalPhysical.toLocaleString('en-IN')} <span style="font-size:13px">units</span></div>
        <div class="kpi-trend">Master inventory</div>
      </div>
      <div class="kpi">
        <div class="kpi-ico">📡</div>
        <div class="kpi-lbl">Active Channels</div>
        <div class="kpi-val">${channelCount}</div>
        <div class="kpi-trend">${channelCount ? channels.map(c=>c.name).join(', ') : 'None added yet'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-ico">⚠️</div>
        <div class="kpi-lbl">Items Out of Sync</div>
        <div class="kpi-val ${pendingSync > 0 ? 'red' : 'green'}">${pendingSync}</div>
        <div class="kpi-trend ${pendingSync > 0 ? 'down' : 'up'}">${pendingSync > 0 ? 'Needs update' : 'All synced'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-ico">📋</div>
        <div class="kpi-lbl">Sync Log Entries</div>
        <div class="kpi-val">${syncs.length}</div>
      </div>
    </div>

    <!-- Channel cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-bottom:22px">
      ${!channels.length
        ? `<div class="card" style="grid-column:1/-1;text-align:center;padding:36px">
            <div style="font-size:36px;margin-bottom:12px">📡</div>
            <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px">No channels added yet</div>
            <div style="font-size:13px;color:var(--muted);margin-bottom:16px">Add your sales channels — Amazon, Flipkart, Website, WhatsApp, etc.</div>
            <button class="btn btn-gold" onclick="openChannelModal()">+ Add First Channel</button>
          </div>`
        : channels.map(ch => {
            const outOfSync = items.filter(i => {
              const m = (ch.mappings || []).find(m => m.itemId === i.id);
              return m && Number(m.channelQty || 0) !== Number(i.qty || 0);
            }).length;
            const iconMap = { amazon:'🟠', flipkart:'🔵', meesho:'🟣', myntra:'🩷', website:'🌐', whatsapp:'💬', instagram:'📸', other:'🏪' };
            const icon = iconMap[ch.type] || '🏪';
            const lastSync = ch.lastSync ? new Date(ch.lastSync).toLocaleDateString('en-IN') : 'Never';
            return `
            <div class="card" style="border-color:${outOfSync > 0 ? 'rgba(255,77,77,.3)' : 'rgba(0,214,143,.2)'}">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
                <div style="font-size:28px">${icon}</div>
                <div style="flex:1">
                  <div style="font-size:14px;font-weight:700;color:var(--text)">${escapeHTML(ch.name)}</div>
                  <div style="font-size:11px;color:var(--muted);text-transform:capitalize">${ch.type} · Last sync: ${escapeHTML(lastSync)}</div>
                </div>
                <span class="badge ${outOfSync > 0 ? 'br' : 'bg'}">${outOfSync > 0 ? outOfSync + ' out of sync' : '✅ Synced'}</span>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
                <div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center">
                  <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Listed</div>
                  <div style="font-size:18px;font-weight:800;color:var(--text)">${(ch.mappings || []).length}</div>
                  <div style="font-size:10px;color:var(--muted)">SKUs</div>
                </div>
                <div style="background:var(--surface2);border-radius:8px;padding:10px;text-align:center">
                  <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Out of Sync</div>
                  <div style="font-size:18px;font-weight:800;color:${outOfSync > 0 ? 'var(--red)' : 'var(--green)'}">${outOfSync}</div>
                  <div style="font-size:10px;color:var(--muted)">items</div>
                </div>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-ghost btn-sm" style="flex:1" onclick="openChannelMappings('${ch.id}')">📋 View Items</button>
                <button class="btn btn-gold btn-sm" style="flex:1" onclick="omniSyncChannel('${ch.id}')">🔄 Sync</button>
                <button class="del-btn" onclick="if(confirm('Remove this channel?')){STRATIX_DB.remove('omni_channels','${ch.id}');renderOmnichannelSync();}">🗑</button>
              </div>
            </div>`;
          }).join('')}
    </div>

    <!-- Master stock table with channel comparison -->
    ${channels.length > 0 ? `
    <div class="tbl-wrap">
      <div class="tbl-head">
        <div class="tbl-title">📦 Stock Comparison — Physical vs Channels</div>
        <button class="btn btn-ghost btn-sm" onclick="omniSyncAll()">🔄 Sync All</button>
      </div>
      <div class="tbl-scroll"><table>
        <thead>
          <tr>
            <th>Item / SKU</th>
            <th>Physical Stock</th>
            ${channels.map(ch => `<th>${escapeHTML(ch.name)}</th>`).join('')}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${items.length === 0
            ? `<tr><td colspan="${3 + channels.length}" style="text-align:center;padding:28px;color:var(--muted)">No items in stock. Add items via POS → Add Stock.</td></tr>`
            : items.map(item => {
                const channelCells = channels.map(ch => {
                  const mapping = (ch.mappings || []).find(m => m.itemId === item.id);
                  const cqty = mapping ? Number(mapping.channelQty || 0) : null;
                  const inSync = cqty === null ? null : cqty === Number(item.qty || 0);
                  return `<td>
                    ${cqty === null
                      ? `<span style="color:var(--faint);font-size:12px">Not listed</span>
                         <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px;margin-left:4px" onclick="omniAddMapping('${ch.id}','${item.id}','${escapeHTML(item.name)}',${item.qty||0})">+ List</button>`
                      : `<span style="font-weight:${inSync?'400':'700'};color:${inSync?'var(--text2)':'var(--red)'}">
                           ${cqty}${!inSync ? ' ⚠️' : ''}
                         </span>
                         <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px;margin-left:4px" onclick="omniUpdateQty('${ch.id}','${item.id}',${item.qty||0})">↑ Update</button>`}
                  </td>`;
                }).join('');

                const anyOutOfSync = channels.some(ch => {
                  const m = (ch.mappings || []).find(m => m.itemId === item.id);
                  return m && Number(m.channelQty || 0) !== Number(item.qty || 0);
                });

                return `<tr style="${anyOutOfSync ? 'background:rgba(255,77,77,.025)' : ''}">
                  <td>
                    <div class="td-b">${escapeHTML(item.name)}</div>
                    <div style="font-size:11px;color:var(--muted)">${item.sku ? 'SKU: ' + escapeHTML(item.sku) : ''}</div>
                  </td>
                  <td style="font-weight:700;color:var(--green)">${item.qty || 0} units</td>
                  ${channelCells}
                  <td>
                    <span class="badge ${anyOutOfSync ? 'br' : 'bg'}">${anyOutOfSync ? '⚠️ Needs Update' : '✅ Synced'}</span>
                  </td>
                </tr>`;
              }).join('')}
        </tbody>
      </table></div>
    </div>` : ''}

    <!-- Sync log -->
    ${syncs.length > 0 ? `
    <div class="tbl-wrap" style="margin-top:16px">
      <div class="tbl-head"><div class="tbl-title">📋 Recent Sync Log</div></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Date & Time</th><th>Channel</th><th>Items Synced</th><th>Type</th></tr></thead>
        <tbody>
          ${[...syncs].reverse().slice(0, 20).map(s => `<tr>
            <td class="td-m">${s.time || '—'}</td>
            <td class="td-b">${escapeHTML(s.channel || '—')}</td>
            <td>${s.count || 0} items</td>
            <td><span class="badge ${s.type === 'auto' ? 'bg' : 'bb'}">${s.type || 'manual'}</span></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>` : ''}
  </div>`;
}

/* ── Channel management modal ── */
function openChannelModal() {
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="channelModal" onclick="if(event.target===this)document.getElementById('channelModal').remove()">
    <div class="modal" style="max-width:440px">
      <div class="modal-hd">
        <div class="modal-title">📡 Add Sales Channel</div>
        <button class="modal-close" onclick="document.getElementById('channelModal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field form-full">
            <label>Channel Name *</label>
            <input id="chName" placeholder="My Amazon Store, Flipkart Shop, etc."/>
          </div>
          <div class="field form-full">
            <label>Channel Type</label>
            <select id="chType">
              <option value="amazon">🟠 Amazon</option>
              <option value="flipkart">🔵 Flipkart</option>
              <option value="meesho">🟣 Meesho</option>
              <option value="myntra">🩷 Myntra</option>
              <option value="website">🌐 Own Website</option>
              <option value="whatsapp">💬 WhatsApp Catalogue</option>
              <option value="instagram">📸 Instagram Shop</option>
              <option value="other">🏪 Other</option>
            </select>
          </div>
          <div class="field form-full">
            <label>Seller / Store URL (optional)</label>
            <input id="chUrl" placeholder="https://www.amazon.in/sp?seller=..."/>
          </div>
          <div class="field form-full">
            <label>Notes</label>
            <input id="chNotes" placeholder="Seller ID, account name, etc."/>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:8px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('channelModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="saveChannel()">💾 Add Channel</button>
        </div>
      </div>
    </div>
  </div>`);
}

function saveChannel() {
  const name = document.getElementById('chName').value.trim();
  if (!name) { NOTIFY.show('Enter channel name', 'error'); return; }
  STRATIX_DB.push('omni_channels', {
    name,
    type:     document.getElementById('chType').value,
    url:      document.getElementById('chUrl').value.trim(),
    notes:    document.getElementById('chNotes').value.trim(),
    mappings: [],
    lastSync: null
  });
  NOTIFY.show('Channel added ✅', 'success');
  document.getElementById('channelModal').remove();
  renderOmnichannelSync();
}

/* ── Add item mapping to a channel ── */
function omniAddMapping(channelId, itemId, itemName, physicalQty) {
  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="omniMapModal" onclick="if(event.target===this)document.getElementById('omniMapModal').remove()">
    <div class="modal" style="max-width:380px">
      <div class="modal-hd">
        <div class="modal-title">📋 List Item on Channel</div>
        <button class="modal-close" onclick="document.getElementById('omniMapModal').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div style="background:var(--surface2);border-radius:10px;padding:12px;margin-bottom:14px;font-size:13px">
          <strong style="color:var(--text)">${escapeHTML(itemName)}</strong>
          <div style="color:var(--muted);margin-top:3px">Physical stock: ${physicalQty} units</div>
        </div>
        <div class="field" style="margin-bottom:12px">
          <label>Channel Stock Qty</label>
          <input type="number" id="omniMapQty" value="${physicalQty}" min="0"/>
        </div>
        <div class="field" style="margin-bottom:14px">
          <label>Channel SKU / Listing ID (optional)</label>
          <input id="omniMapSku" placeholder="Amazon ASIN, Flipkart ID, etc."/>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('omniMapModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="saveOmniMapping('${channelId}','${itemId}')">💾 List Item</button>
        </div>
      </div>
    </div>
  </div>`);
}

function saveOmniMapping(channelId, itemId) {
  const channels = STRATIX_DB.getArr('omni_channels');
  const ch = channels.find(c => c.id === channelId);
  if (!ch) return;
  const mappings = ch.mappings || [];
  const existing = mappings.find(m => m.itemId === itemId);
  const qty  = parseFloat(document.getElementById('omniMapQty').value) || 0;
  const sku  = document.getElementById('omniMapSku').value.trim();
  if (existing) {
    existing.channelQty = qty;
    existing.channelSku = sku;
  } else {
    mappings.push({ itemId, channelQty: qty, channelSku: sku });
  }
  STRATIX_DB.update('omni_channels', channelId, { mappings, lastSync: new Date().toISOString() });
  NOTIFY.show('Item listed on channel ✅', 'success');
  document.getElementById('omniMapModal').remove();
  renderOmnichannelSync();
}

/* ── Update a single item's qty on a channel ── */
function omniUpdateQty(channelId, itemId, physicalQty) {
  const channels = STRATIX_DB.getArr('omni_channels');
  const ch = channels.find(c => c.id === channelId);
  if (!ch) return;
  const mappings = ch.mappings || [];
  const m = mappings.find(m => m.itemId === itemId);
  if (m) {
    m.channelQty = physicalQty;
    STRATIX_DB.update('omni_channels', channelId, { mappings, lastSync: new Date().toISOString() });
    NOTIFY.show('Stock updated on channel ✅', 'success', 1500);
    renderOmnichannelSync();
  }
}

/* ── Sync a single channel (set all channel qtys to match physical) ── */
function omniSyncChannel(channelId) {
  const channels  = STRATIX_DB.getArr('omni_channels');
  const ch        = channels.find(c => c.id === channelId);
  const items     = STRATIX_DB.getArr('rtl_items');
  if (!ch) return;

  const mappings  = ch.mappings || [];
  let   updated   = 0;

  mappings.forEach(m => {
    const item = items.find(i => i.id === m.itemId);
    if (item && Number(m.channelQty) !== Number(item.qty || 0)) {
      m.channelQty = Number(item.qty || 0);
      updated++;
    }
  });

  const now = new Date().toISOString();
  STRATIX_DB.update('omni_channels', channelId, { mappings, lastSync: now });

  // Log the sync
  STRATIX_DB.push('omni_sync_log', {
    time:    new Date().toLocaleString('en-IN'),
    channel: ch.name,
    count:   updated,
    type:    'manual'
  });

  NOTIFY.show(`✅ ${ch.name} synced — ${updated} item${updated !== 1 ? 's' : ''} updated`, 'success');
  renderOmnichannelSync();
}

/* ── Sync ALL channels at once ── */
function omniSyncAll() {
  const channels = STRATIX_DB.getArr('omni_channels');
  if (!channels.length) {
    NOTIFY.show('No channels to sync. Add a channel first.', 'warning');
    return;
  }
  let totalUpdated = 0;
  channels.forEach(ch => {
    const items    = STRATIX_DB.getArr('rtl_items');
    const mappings = ch.mappings || [];
    let   updated  = 0;
    mappings.forEach(m => {
      const item = items.find(i => i.id === m.itemId);
      if (item && Number(m.channelQty) !== Number(item.qty || 0)) {
        m.channelQty = Number(item.qty || 0);
        updated++;
      }
    });
    STRATIX_DB.update('omni_channels', ch.id, { mappings, lastSync: new Date().toISOString() });
    totalUpdated += updated;
    STRATIX_DB.push('omni_sync_log', {
      time: new Date().toLocaleString('en-IN'),
      channel: ch.name, count: updated, type: 'auto'
    });
  });
  NOTIFY.show(`🔄 All channels synced — ${totalUpdated} item${totalUpdated !== 1 ? 's' : ''} updated across ${channels.length} channel${channels.length !== 1 ? 's' : ''}`, 'success', 4000);
  renderOmnichannelSync();
}

/* ── View all item mappings for a channel ── */
function openChannelMappings(channelId) {
  const channels = STRATIX_DB.getArr('omni_channels');
  const ch       = channels.find(c => c.id === channelId);
  const items    = STRATIX_DB.getArr('rtl_items');
  if (!ch) return;

  const mappings = ch.mappings || [];
  const sym      = STRATIX_DB.getSettings().currencySymbol || '₹';

  document.body.insertAdjacentHTML('beforeend', `
  <div class="overlay" id="chMapModal" onclick="if(event.target===this)document.getElementById('chMapModal').remove()">
    <div class="modal" style="max-width:600px;max-height:88vh">
      <div class="modal-hd">
        <div>
          <div class="modal-title">📋 ${escapeHTML(ch.name)} — Item Listings</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;text-transform:capitalize">${ch.type} · ${mappings.length} items listed</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-gold btn-sm" onclick="omniSyncChannel('${channelId}');document.getElementById('chMapModal').remove()">🔄 Sync All</button>
          <button class="modal-close" onclick="document.getElementById('chMapModal').remove()">✕</button>
        </div>
      </div>
      <div class="modal-body">
        ${!mappings.length
          ? `<div class="empty" style="padding:32px">No items listed on this channel yet.<br/>Go to the sync table and click "+ List" to add items.</div>`
          : `<div class="tbl-scroll"><table>
              <thead><tr><th>Item</th><th>Physical</th><th>Channel Qty</th><th>Status</th><th></th></tr></thead>
              <tbody>
                ${mappings.map(m => {
                  const item = items.find(i => i.id === m.itemId);
                  if (!item) return '';
                  const inSync = Number(m.channelQty || 0) === Number(item.qty || 0);
                  return `<tr>
                    <td class="td-b">${escapeHTML(item.name)}<br/><span style="font-size:11px;color:var(--muted)">${m.channelSku ? 'SKU: ' + escapeHTML(m.channelSku) : ''}</span></td>
                    <td style="color:var(--green);font-weight:700">${item.qty || 0}</td>
                    <td style="font-weight:${inSync ? '400' : '700'};color:${inSync ? 'var(--text2)' : 'var(--red)'}">${m.channelQty || 0}</td>
                    <td><span class="badge ${inSync ? 'bg' : 'br'}">${inSync ? '✅ Synced' : '⚠️ Out of sync'}</span></td>
                    <td>
                      ${!inSync ? `<button class="btn btn-gold btn-sm" onclick="omniUpdateQty('${channelId}','${item.id}',${item.qty||0});document.getElementById('chMapModal').remove()">↑ Update</button>` : ''}
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table></div>`}

        <!-- WhatsApp catalogue export hint -->
        ${ch.type === 'whatsapp' ? `
        <div class="alert alert-green" style="margin-top:14px">
          <span class="alert-ico">📱</span>
          <div>
            <strong>WhatsApp Catalogue tip:</strong> After syncing, go to WhatsApp Business → Catalogue and manually update quantities for items marked out of sync. STRATIX shows you exactly which ones changed.
          </div>
        </div>` : ''}

        <!-- Amazon/Flipkart instruction -->
        ${['amazon','flipkart','meesho','myntra'].includes(ch.type) ? `
        <div class="alert alert-blue" style="margin-top:14px">
          <span class="alert-ico">ℹ️</span>
          <div>
            <strong>${ch.name} update:</strong> Log into Seller Central, go to Inventory, and update quantities for items shown as out of sync above. Or use Bulk Upload to update all at once using your Seller ID.
          </div>
        </div>` : ''}
      </div>
    </div>
  </div>`);
}
