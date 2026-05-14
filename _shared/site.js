
// ── MOBILE TOUR CARD TAP ─────────────────────────────────────────────────
document.querySelectorAll('.tour-card').forEach(card => {
  card.addEventListener('click', function(e) {
    // Don't interfere with the Book button link
    if(e.target.closest('.tour-book-btn')) return;
    const isActive = this.classList.contains('active');
    // Close all cards
    document.querySelectorAll('.tour-card').forEach(c => c.classList.remove('active'));
    // Toggle clicked card
    if(!isActive) this.classList.add('active');
  });
});

// Modal helpers
function openModal(id){
  document.getElementById(id).classList.add('open');
  document.body.style.overflow='hidden';
}
function closeModal(id,e){
  if(e&&e.target!==document.getElementById(id))return;
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow='';
}
document.addEventListener('keydown',function(e){
  if(e.key==='Escape') document.querySelectorAll('.modal-overlay.open').forEach(m=>{m.classList.remove('open');document.body.style.overflow='';});
});

let lang='en';
function setLang(l,e){
  lang=l;
  document.querySelectorAll('[data-en]').forEach(el=>{
    const val=el.getAttribute('data-'+l);
    if(!val)return;
    // Translate if no real child elements (br tags are ok)
    const realChildren=Array.from(el.children).filter(c=>c.tagName!=='BR');
    if(realChildren.length===0){
      el.innerHTML=val;
    }
  });
  document.querySelectorAll('#tour-select option').forEach(opt=>{
    const val=opt.getAttribute('data-'+l);
    if(val)opt.textContent=val;
  });
  document.querySelectorAll('.lang-btn').forEach(b=>b.classList.remove('active'));
  if(e)e.target.classList.add('active');
}
function toggleFaq(el){const item=el.parentElement;const open=item.classList.contains('open');document.querySelectorAll('.faq-item').forEach(i=>i.classList.remove('open'));if(!open)item.classList.add('open');}
const obs=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting)e.target.classList.remove('hidden');});},{threshold:0.08});
document.querySelectorAll('.reveal').forEach(el=>{el.classList.add('hidden');obs.observe(el);});
// ── FORMSPREE SUBMIT ──────────────────────────────────────────
// Paso 1: Ve a https://formspree.io y crea cuenta gratis
// Paso 2: Crea un nuevo formulario → copia el endpoint
// Paso 3: Reemplaza YOUR_FORM_ID aquí abajo con tu ID
const FORMSPREE_ID = 'mjgjbool';

document.getElementById('form-submit-btn').addEventListener('click', async function(e){
  e.preventDefault();
  const btn = this;
  const form = btn.closest('.booking-form');

  // Recolectar datos
  const data = {
    first_name: form.querySelector('[name="first_name"]').value,
    last_name:  form.querySelector('[name="last_name"]').value,
    email:      form.querySelector('[name="email"]').value,
    phone:      form.querySelector('[name="phone"]').value,
    experience: form.querySelector('[name="experience"]').value,
    riders:     form.querySelector('[name="riders"]').value,
    date:       form.querySelector('[name="date"]').value,
    notes:      form.querySelector('[name="notes"]').value,
  };

  // Validación básica
  if(!data.first_name || !data.email){
    alert(lang==='es' ? 'Por favor ingresa tu nombre y email.' : 'Please enter your name and email.');
    return;
  }

  btn.textContent = lang==='es' ? 'ENVIANDO...' : 'SENDING...';
  btn.disabled = true;

  try {
    const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    });

    if(res.ok){
      btn.textContent = lang==='es' ? '¡SOLICITUD ENVIADA ✓' : 'REQUEST SENT ✓';
      btn.style.background = '#22c55e';
      btn.style.color = '#fff';
      // Limpiar form
      form.querySelectorAll('input, textarea').forEach(f => f.value = '');
    } else {
      throw new Error('Server error');
    }
  } catch(err){
    btn.textContent = lang==='es' ? 'ERROR — intenta por WhatsApp' : 'ERROR — try via WhatsApp';
    btn.style.background = '#ef4444';
    btn.style.color = '#fff';
    btn.disabled = false;
  }
});
// Hamburger nav
(function(){
  var burger=document.getElementById('navBurger');
  var menu=document.querySelector('.nav-links');
  if(!burger||!menu) return;
  burger.addEventListener('click',function(){
    burger.classList.toggle('open');
    menu.classList.toggle('open');
    document.body.style.overflow=menu.classList.contains('open')?'hidden':'';
  });
  menu.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click',function(){
      burger.classList.remove('open');
      menu.classList.remove('open');
      document.body.style.overflow='';
    });
  });
})();