// Config for Google Sheets
const GOOGLE_SHEET_ID = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRGnB1eDtUbSC4vxxAdi-VVeIxB7nfKG09Z0cwxYDp4x3BupYFaYR1LVhtD8lKwziPz-ZBZ_M_FTnAP/pub?gid=1480991967&single=true&output=csv'; // e.g. "1sDFj...U0"
const GOOGLE_API_KEY = 'YOUR_API_KEY_HERE';
const SHEET_NAME = 'Import';

// Helper to fetch Google Sheets
async function fetchSheet() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${SHEET_NAME}?key=${GOOGLE_API_KEY}`;
  const response = await fetch(url);
  if(!response.ok) throw new Error('Failed to load data');
  const { values } = await response.json();
  return values;
}

// Parse rows to objects
function sheetToObjects(rows) {
  const [header,...data] = rows;
  return data.map(row=>{
    const obj={}; header.forEach((h,i)=>{obj[h]=row[i]||'';}); return obj;
  });
}

// Main Dashboard Logic
async function loadDashboard(){
  document.getElementById('loading').style.display='block';
  document.getElementById('error-message').style.display='none';
  try {
    const rows = await fetchSheet();
    const data = sheetToObjects(rows);
    renderFilters(data);
    renderSummary(data);
    renderDashboard(data);
    document.getElementById('loading').style.display='none';
  } catch(err){
    document.getElementById('loading').style.display='none';
    document.getElementById('error-message').style.display='block';
    document.getElementById('error-message').textContent='Error: '+err.message;
  }
}

// Render filter dropdowns
function renderFilters(data){
  const schools = [...new Set(data.map(d=>d.batch_or_school_name).filter(s=>s))].sort();
  const subjects = [...new Set(data.map(d=>d.subject).filter(s=>s))].sort();
  const months = [...new Set(data.map(d=>d.session_date.substring(0,7)).filter(m=>m))].sort();

  let schoolFilter = document.getElementById('schoolFilter');
  schoolFilter.innerHTML = '<option value="">All Schools</option>' + schools.map(s=>`<option>${s}</option>`).join('');
  let subjectFilter = document.getElementById('subjectFilter');
  subjectFilter.innerHTML = '<option value="">All Subjects</option>' + subjects.map(s=>`<option>${s}</option>`).join('');
  let monthFilter = document.getElementById('monthFilter');
  monthFilter.innerHTML = '<option value="">All Months</option>' + months.map(m=>`<option>${m}</option>`).join('');

  // Add event listeners for filtering
  document.getElementById('schoolFilter').onchange = () => filterDashboard(data);
  document.getElementById('subjectFilter').onchange = () => filterDashboard(data);
  document.getElementById('monthFilter').onchange = () => filterDashboard(data);
  document.getElementById('clearFilters').onclick = () => {schoolFilter.value = ''; subjectFilter.value = ''; monthFilter.value = ''; filterDashboard(data);}
}

// Filter logic
function filterDashboard(data){
  let s = document.getElementById('schoolFilter').value;
  let sub = document.getElementById('subjectFilter').value;
  let m = document.getElementById('monthFilter').value;
  let filtered = data.filter(d=>{
    return (!s||d.batch_or_school_name===s)
      && (!sub||d.subject===sub)
      && (!m||d.session_date.substring(0,7)===m);
  });
  renderSummary(filtered);
  renderDashboard(filtered);
}

// Summary Cards
function renderSummary(data){
  let schools = [...new Set(data.map(d=>d.batch_or_school_name).filter(s=>s))];
  let subjects = [...new Set(data.map(d=>d.subject).filter(s=>s))];
  let classesDone = data.filter(d=>d.session_type=='Class' && d.chapter_status=='Completed').length;
  let classesTotal = data.filter(d=>d.session_type=='Class').length;
  let testsDone = data.filter(d=>d.session_type=='Test' && d.chapter_status=='Completed').length;
  let testsTotal = data.filter(d=>d.session_type=='Test').length;
  document.getElementById('statSchools').textContent = `Schools: ${schools.length}`;
  document.getElementById('statSubjects').textContent = `Subjects: ${subjects.length}`;
  document.getElementById('statCompletion').textContent =
    `Classes: ${classesDone}/${classesTotal} (${((classesDone/classesTotal)*100||0).toFixed(1)}%) | Tests: ${testsDone}/${testsTotal} (${((testsDone/testsTotal)*100||0).toFixed(1)}%)`;
}

// Dashboard Charts and Table
function renderDashboard(data){
  // Prepare data
  let bySchool = {}; let bySubject = {}; let byMonth = {};
  data.forEach(d=>{
    // Progress per school/subject
    let key1 = d.batch_or_school_name+'_'+d.subject;
    bySchool[key1] = bySchool[key1]||{total:0,done:0,subject:d.subject,school:d.batch_or_school_name};
    if(d.session_type=='Class'){bySchool[key1].total++;}
    if(d.session_type=='Class'&&d.chapter_status=='Completed'){bySchool[key1].done++;}
    // Progress per month
    let mkey=d.session_date.substring(0,7)+'_'+d.subject;
    byMonth[mkey]=byMonth[mkey]||{total:0,done:0,month:d.session_date.substring(0,7),subject:d.subject};
    if(d.session_type=='Class'){byMonth[mkey].total++;}
    if(d.session_type=='Class'&&d.chapter_status=='Completed'){byMonth[mkey].done++;}
  });

  let labels=Object.values(bySchool).map(d=>(d.school+'-'+d.subject));
  let classTotals = Object.values(bySchool).map(d=>d.total);
  let classDone = Object.values(bySchool).map(d=>d.done);

  // Chart.js progress chart
  let ctx=document.getElementById('progressChart').getContext('2d');
  if(window.progressChart){window.progressChart.destroy();}
  window.progressChart=new Chart(ctx,{
    type:'bar',
    data:{labels:labels,datasets:[
      {label:'Total',data:classTotals,backgroundColor:'#ffe066'},
      {label:'Completed',data:classDone,backgroundColor:'#e94f37'}
    ]},
    options:{responsive:true,plugins:{legend:{position:'top'}}}
  });

  // Table
  let tableHTML = `<table><tr><th>School</th><th>Subject</th><th>Classes Done</th><th>Total Classes</th></tr>`;
  Object.values(bySchool).forEach(d=>{
    tableHTML += `<tr><td>${d.school}</td><td>${d.subject}</td><td>${d.done}</td><td>${d.total}</td></tr>`;
  });
  tableHTML += `</table>`;
  document.getElementById('dataTable').innerHTML=tableHTML;

  // Export feature
  document.getElementById('exportCSV').onclick = ()=>{
    let csv = 'School,Subject,Classes_Done,Classes_Total\n'+Object.values(bySchool)
      .map(d=>`${d.school},${d.subject},${d.done},${d.total}`).join('\n');
    let blob = new Blob([csv],{type:'text/csv'});
    let a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download='curriculum_tracker.csv';
    a.click();
  }
}

// Start
window.onload = loadDashboard;
