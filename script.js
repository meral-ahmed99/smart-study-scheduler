var KEY = 'sss_tasks_v1';
var COLORS = ['#7c3aed', '#ec4899', '#f97316', '#14b8a6', '#3b82f6', '#65a30d'];
var tasks = [];
var rowCount = 0;

function $(id){ return document.getElementById(id); }
function esc(s){ var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

/* same subject name always gets the same colour */
function colorFor(text){
  var key = (text || 'none').toLowerCase(), h = 0;
  for(var i = 0; i < key.length; i++){ h = (h * 31 + key.charCodeAt(i)) % 997; }
  return COLORS[h % COLORS.length];
}

/* ---------- saving ---------- */
function load(){
  try { tasks = JSON.parse(localStorage.getItem(KEY)) || []; } catch(e){ tasks = []; }
}
function save(){
  try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch(e){}
}

/* ---------- dates ---------- */
function startOfDay(d){ var x = new Date(d); x.setHours(0,0,0,0); return x; }
function parseDate(s){ var p = s.split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }
function daysLeft(s){ return Math.round((parseDate(s) - startOfDay(new Date())) / 86400000); }
function fmt(d){ return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }); }

/* ---------- task entry rows ---------- */
function addRow(){
  rowCount++;
  var div = document.createElement('div');
  div.className = 'row';
  div.style.setProperty('--c', COLORS[(rowCount - 1) % COLORS.length]);
  div.innerHTML =
    '<div class="row-title">Task ' + rowCount + '</div>' +
    '<div class="fields">' +
      '<div class="wide"><label>Task name</label><input class="f-name" placeholder="e.g. AICT Project 2"></div>' +
      '<div class="wide"><label>Subject</label><input class="f-subject" placeholder="e.g. AICT"></div>' +
      '<div><label>Due date</label><input class="f-due" type="date"></div>' +
      '<div><label>Hours needed</label><input class="f-hours" type="number" min="0.5" step="0.5" value="2"></div>' +
      '<div class="wide"><label>Importance</label><select class="f-prio">' +
        '<option value="1">Normal</option><option value="2">High</option><option value="3">Very high</option>' +
      '</select></div>' +
    '</div>';
  $('rows').appendChild(div);
}

function saveAll(){
  var rows = document.querySelectorAll('#rows .row');
  var added = 0, problem = false;
  rows.forEach(function(r){
    var name = r.querySelector('.f-name').value.trim();
    var due = r.querySelector('.f-due').value;
    var hours = parseFloat(r.querySelector('.f-hours').value);
    if(!name && !due){ return; }                       // empty row, skip
    if(!name || !due || !(hours > 0)){ problem = true; return; }
    tasks.push({
      id: Date.now() + added,
      name: name,
      subject: r.querySelector('.f-subject').value.trim(),
      due: due, hours: hours,
      prio: +r.querySelector('.f-prio').value,
      done: false
    });
    added++;
    r.querySelector('.f-name').value = '';
    r.querySelector('.f-subject').value = '';
    r.querySelector('.f-due').value = '';
  });
  if(problem){ alert('Some tasks are incomplete. Each task needs a name, due date and hours.'); }
  if(added){ save(); render(); }
  else if(!problem){ alert('Please fill in at least one task.'); }
}

/* ---------- task list ---------- */
function render(){
  var open = tasks.filter(function(t){ return !t.done; });
  var hrs = open.reduce(function(s,t){ return s + t.hours; }, 0);
  var urgent = open.filter(function(t){ return daysLeft(t.due) <= 1; }).length;
  $('stats').innerHTML =
    '<div class="stat"><b>' + open.length + '</b><span>Tasks left</span></div>' +
    '<div class="stat"><b>' + hrs + '</b><span>Hours of work</span></div>' +
    '<div class="stat"><b>' + urgent + '</b><span>Urgent (1 day or less)</span></div>';

  var box = $('list');
  if(!tasks.length){ box.innerHTML = '<p class="empty">No tasks yet. Add your tasks in Step 1.</p>'; return; }

  var sorted = tasks.slice().sort(function(a,b){
    if(a.done !== b.done) return a.done ? 1 : -1;
    return parseDate(a.due) - parseDate(b.due);
  });
  box.innerHTML = sorted.map(function(t){
    var dl = daysLeft(t.due);
    var cls = dl <= 1 ? 'urgent' : dl <= 3 ? 'soon' : 'ok';
    var when = dl < 0 ? 'Overdue' : dl === 0 ? 'Due today' : dl + ' day' + (dl > 1 ? 's' : '') + ' left';
    return '<div class="task' + (t.done ? ' done' : '') + '" style="--c:' + colorFor(t.subject) + '"><div>' +
      '<div class="name">' + esc(t.name) + '</div>' +
      '<div class="meta"><span class="pill">' + esc(t.subject || 'No subject') + '</span>' +
      '<span class="pill ' + cls + '">' + when + '</span><br>Deadline: ' + fmt(parseDate(t.due)) + ' | ' + t.hours + ' h needed</div></div>' +
      '<div><button class="btn small" data-act="done" data-id="' + t.id + '">' + (t.done ? 'Undo' : 'Done') + '</button> ' +
      '<button class="btn small danger" data-act="del" data-id="' + t.id + '">Delete</button></div></div>';
  }).join('');
}

function listClick(e){
  var b = e.target.closest('button');
  if(!b) return;
  var id = +b.dataset.id;
  if(b.dataset.act === 'del'){
    tasks = tasks.filter(function(t){ return t.id !== id; });
  } else {
    tasks.forEach(function(t){ if(t.id === id) t.done = !t.done; });
  }
  save(); render();
}

/* ---------- schedule builder ---------- */
function buildPlan(){
  var cap = parseFloat($('free').value);
  var out = $('result');
  if(!(cap > 0)){ out.innerHTML = '<div class="msg bad">Enter your free hours per day.</div>'; return; }

  var open = tasks.filter(function(t){ return !t.done; }).map(function(t){
    return { name: t.name, subject: t.subject, due: parseDate(t.due), left: t.hours, prio: t.prio, start: null, end: null };
  });
  if(!open.length){ out.innerHTML = '<p class="empty">Nothing to schedule. Add tasks first.</p>'; return; }

  // earliest deadline first, then most important
  open.sort(function(a,b){ return (a.due - b.due) || (b.prio - a.prio); });

  var today = startOfDay(new Date());
  var last = open[open.length - 1].due;
  var html = '';
  var day = new Date(today);

  while(day <= last){
    var room = cap, items = '';
    open.forEach(function(t){
      if(t.left > 0 && t.due >= day && room > 0){
        var use = Math.min(t.left, room);
        t.left -= use; room -= use;
        if(!t.start){ t.start = new Date(day); }
        t.end = new Date(day);
        items += '<div class="item" style="--c:' + colorFor(t.subject) + '">' + esc(t.name) +
                 ' <span class="meta">(' + use + ' h' + (t.subject ? ', ' + esc(t.subject) : '') + ')</span>' +
                 '<div class="bar" style="width:' + Math.round(use / cap * 100) + '%"></div></div>';
      }
    });
    if(items){
      var isToday = day.getTime() === today.getTime();
      html += '<div class="day"><div class="date' + (isToday ? ' today' : '') + '">' +
        day.toLocaleDateString(undefined, { weekday: 'short' }) +
        '<b>' + day.getDate() + '</b>' +
        day.toLocaleDateString(undefined, { month: 'short' }) + '</div>' +
        '<div class="items">' + items + '</div></div>';
    }
    day.setDate(day.getDate() + 1);
  }

  // summary: start, finish and deadline for each task
  var sum = '<h3 class="sumtitle">Start, finish and deadline</h3>';
  open.forEach(function(t){
    var s = '<div class="sum" style="--c:' + colorFor(t.subject) + '"><b>' + esc(t.name) + '</b><br>';
    if(t.start){
      var days = Math.round((t.end - t.start) / 86400000) + 1;
      s += '<span class="meta">Start: ' + fmt(t.start) + ' | Finish: ' + fmt(t.end) + ' (' + days + ' day' + (days > 1 ? 's' : '') + ')</span><br>';
    }
    s += '<span class="meta">Deadline: ' + fmt(t.due) + '</span></div>';
    sum += s;
  });

  var late = open.filter(function(t){ return t.left > 0; });
  var msg = late.length
    ? '<div class="msg bad">Not enough time! With ' + cap + ' h/day these cannot finish: ' +
      late.map(function(t){ return esc(t.name) + ' (short by ' + t.left + ' h)'; }).join(', ') +
      '. Increase your free hours or ask for more time.</div>'
    : '<div class="msg good">Good news: everything fits before its deadline.</div>';
  out.innerHTML = msg + html + sum;
}

/* ---------- start ---------- */
$('moreRow').onclick = addRow;
$('addAll').onclick = saveAll;
$('list').onclick = listClick;
$('plan').onclick = buildPlan;

load();
addRow(); addRow(); addRow();   // 3 task rows by default
render();
