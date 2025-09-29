// Update the following with your sheet details:
const GOOGLE_SHEET_ID = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRGnB1eDtUbSC4vxxAdi-VVeIxB7nfKG09Z0cwxYDp4x3BupYFaYR1LVhtD8lKwziPz-ZBZ_M_FTnAP/pub?gid=1480991967&single=true&output=csv';
const SHEET_GID = '0'; // default sheet tab gid, change if needed

async function fetchCSV() {
  const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
  const response = await fetch(url);
  if(!response.ok) throw new Error('Failed to fetch Google Sheet CSV');
  return await response.text();
}

function csvToArray(str, delimiter = ',') {
  // Simple CSV to array parser
  const rows = str.trim().split('\n');
  return rows.map(row => row.split(delimiter).map(cell => cell.trim()));
}

function rowsToObjects(rows) {
  const headers = rows[0];
  return rows.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  });
}

let currentTab = 'classes';

function initTabs() {
  const tabs = document.querySelectorAll('#tabs button');
  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      if(window.data) renderDashboard(window.data);
    };
  });
}

function applyFilters(data) {
  const school = document.getElementById('schoolFilter').value;
  const subject = document.getElementById('subjectFilter').value;
  const month = document.getElementById('monthFilter').value;

  return data.filter(d => {
    let cond = true;
    if(school) cond = cond && (d.batch_or_school_name === school);
    if(subject) cond = cond && (d.subject === subject);
    if(month) cond = cond && d.session_date.startsWith(month);
    return cond;
  });
}

function populateFilterOptions(data) {
  const schools = [...new Set(data.map(d => d.batch_or_school_name).filter(Boolean))].sort();
  const subjects = [...new Set(data.map(d => d.subject).filter(Boolean))].sort();
  const months = [...new Set(data.map(d => d.session_date.substring(0,7)).filter(Boolean))].sort();

  const schoolSelect = document.getElementById('schoolFilter');
  const subjectSelect = document.getElementById('subjectFilter');
  const monthSelect = document.getElementById('monthFilter');

  schoolSelect.innerHTML = `<option value="">All Schools</option>${schools.map(s => `<option>${s}</option>`).join('')}`;
  subjectSelect.innerHTML = `<option value="">All Subjects</option>${subjects.map(s => `<option>${s}</option>`).join('')}`;
  monthSelect.innerHTML = `<option value="">All Months</option>${months.map(m => `<option>${m}</option>`).join('')}`;

  schoolSelect.onchange = () => renderDashboard(window.data);
  subjectSelect.onchange = () => renderDashboard(window.data);
  monthSelect.onchange = () => renderDashboard(window.data);

  document.getElementById('clearFilters').onclick = () => {
    schoolSelect.value = '';
    subjectSelect.value = '';
    monthSelect.value = '';
    renderDashboard(window.data);
  };
}

function summarize(data) {
  const schools = new Set(data.map(d=>d.batch_or_school_name).filter(Boolean));
  const subjects = new Set(data.map(d=>d.subject).filter(Boolean));
  const classesDone = data.filter(d=>d.session_type==='Class' && d.chapter_status==='Completed').length;
  const classesTotal = data.filter(d=>d.session_type==='Class').length;
  const testsDone = data.filter(d=>d.session_type==='Test' && d.chapter_status==='Completed').length;
  const testsTotal = data.filter(d=>d.session_type==='Test').length;

  document.getElementById('statSchools').textContent = `Schools: ${schools.size}`;
  document.getElementById('statSubjects').textContent = `Subjects: ${subjects.size}`;
  document.getElementById('statCompletion').textContent =
    `Classes: ${classesDone} / ${classesTotal} (${(classesTotal ? (classesDone/classesTotal*100).toFixed(1) : 0)}%) | ` +
    `Tests: ${testsDone} / ${testsTotal} (${(testsTotal ? (testsDone/testsTotal*100).toFixed(1) : 0)}%)`;
}

function renderDashboard(data) {
  const filteredData = applyFilters(data);

  summarize(filteredData);

  if(currentTab==='classes') {
    renderProgressChart(filteredData.filter(d => d.session_type==='Class'));
  } else if(currentTab==='tests') {
    renderProgressChart(filteredData.filter(d => d.session_type==='Test'));
  } else {
    renderMonthlyTrend(filteredData);
  }

  renderTable(filteredData);
}

let chartInstance = null;

function renderProgressChart(data) {
  // Group by school-subject and completion rate
  let grouped = {};
  data.forEach(d => {
    const key = `${d.batch_or_school_name}|${d.subject}`;
    if(!grouped[key]) grouped[key] = {total:0, completed:0, school:d.batch_or_school_name, subject:d.subject};
    grouped[key].total++;
    if(d.chapter_status==='Completed') grouped[key].completed++;
  });

  const labels = [];
  const totalCounts = [];
  const completedCounts = [];

  Object.values(grouped).forEach(g => {
    labels.push(`${g.school} - ${g.subject}`);
    totalCounts.push(g.total);
    completedCounts.push(g.completed);
  });

  const ctx = document.getElementById('progressChart').getContext('2d');
  if(chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {label:'Total Sessions', data: totalCounts, backgroundColor: '#ffe066'},
        {label:'Completed Sessions', data: completedCounts, backgroundColor: '#e94f37'}
      ]
    },
    options: {
      responsive:true,
      plugins: {legend: {position: 'top'}},
      scales: {
        y: {beginAtZero: true, precision: 0 }
      }
    }
  });
}

function renderMonthlyTrend(data) {
  // Group by month and subject for classes only
  let grouped = {};
  data.filter(d=>d.session_type==='Class').forEach(d => {
    const key = `${d.session_date.substring(0,7)}|${d.subject}`;
    if(!grouped[key]) grouped[key] = {total:0, completed:0, month:d.session_date.substring(0,7), subject:d.subject};
    grouped[key].total++;
    if(d.chapter_status==='Completed') grouped[key].completed++;
  });

  const months = [...new Set(data.map(d => d.session_date.substring(0,7)))].sort();
  const subjects = [...new Set(data.map(d => d.subject))].filter(Boolean).sort();

  const datasets = subjects.map((subject, idx) => {
    const dataPoints = months.map(month => {
      const key = `${month}|${subject}`;
      const g = grouped[key];
      return g ? (g.completed / g.total) * 100 : 0;
    });
    const colors = ['#e94f37','#ffe066','#e08f55','#f7b733'];
    return {
      label: subject,
      data: dataPoints,
      borderColor: colors[idx % colors.length],
      fill: false,
      tension: 0.1
    };
  });

  const ctx = document.getElementById('progressChart').getContext('2d');
  if(chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets
    },
    options: {
      responsive:true,
      plugins: {legend: {position: 'top'}},
      scales: {
        y: {beginAtZero: true, max: 100, title: {display: true, text: 'Completion %'} }
      }
    }
  });
}

function renderTable(data) {
  let html = `<table>
    <thead>
      <tr><th>School</th><th>Subject</th><th>Session Type</th><th>Chapter Status</th><th>Session Date</th></tr>
    </thead><tbody>`;

  data.forEach(d => {
    html += `<tr>
      <td>${d.batch_or_school_name}</td>
      <td>${d.subject}</td>
      <td>${d.session_type}</td>
      <td>${d.chapter_status}</td>
      <td>${d.session_date}</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  document.getElementById('dataTable').innerHTML = html;
}

function downloadCSV(data) {
  const headers = ['batch_or_school_name','subject','session_type','chapter_status','session_date'];
  const csvRows = [headers.join(',')];
  data.forEach(d => {
    const row = headers.map(h => `"${(d[h] || '').replace(/"/g,'""')}"`).join(',');
    csvRows.push(row);
  });
  return csvRows.join('\n');
}

document.getElementById('exportCSV').addEventListener('click', () => {
  if(!window.data) return alert('Data not loaded yet.');
  const filteredData = applyFilters(window.data);
  const csv = downloadCSV(filteredData);
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'curriculum_tracking.csv';
  a.click();
});

async function init() {
  document.getElementById('loading').style.display = 'block';
  try {
    const csvText = await fetchCSV();
    let rows = csvToArray(csvText);
    let parsedData = rowsToObjects(rows);
    // Clean up subject spelling consistency (Maths -> Mathematics)
    parsedData.forEach(d => {
      if(d.subject && d.subject.toLowerCase()=='maths') d.subject = 'Mathematics';
    });
    window.data = parsedData;
    populateFilterOptions(parsedData);
    renderDashboard(parsedData);
    initTabs();
    document.getElementById('loading').style.display = 'none';
  } catch(err) {
    document.getElementById('error-message').textContent = 'Error loading data: ' + err.message;
    document.getElementById('error-message').style.display = 'block';
    document.getElementById('loading').style.display = 'none';
  }
}

window.onload = init;
