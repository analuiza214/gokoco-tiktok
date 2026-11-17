(function(){
  var products=JSON.parse(document.getElementById('forja-catalog-data').textContent);
  var search=document.getElementById('catalog-search'),category=document.getElementById('catalog-category'),sort=document.getElementById('catalog-sort');
  function normalized(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
  function fmt(v){return Number(v).toFixed(2).replace('.',',');}
  function render(){
    var q=normalized(search.value.trim());
    var items=products.filter(function(p){return (!q||normalized(p.title).includes(q))&&(!category.value||category.value===p.category);});
    if(sort.value==='asc')items.sort(function(a,b){return a.price-b.price;});
    if(sort.value==='desc')items.sort(function(a,b){return b.price-a.price;});
    if(sort.value==='name')items.sort(function(a,b){return a.title.localeCompare(b.title,'pt-BR');});
    document.getElementById('catalog-results').textContent=items.length+' '+(items.length===1?'produto encontrado':'produtos encontrados');
    document.querySelectorAll('.grid').forEach(function(grid){
      grid.textContent='';
      if(!items.length){var empty=document.createElement('p');empty.className='empty-catalog';empty.textContent='Nenhum produto encontrado. Tente outro termo.';grid.appendChild(empty);return;}
      items.forEach(function(p){
        var card=document.createElement('a');card.className='product';card.href=p.url;
        var photo=document.createElement('div');photo.className='photo';var image=document.createElement('img');image.src=p.image;image.alt=p.title;image.loading='lazy';photo.appendChild(image);
        var shipping=document.createElement('span');shipping.className='shipping';shipping.textContent='Frete grátis';photo.appendChild(shipping);card.appendChild(photo);
        var info=document.createElement('div');info.className='info';var title=document.createElement('p');title.className='title';title.textContent=p.title;info.appendChild(title);
        var price=document.createElement('span');price.className='price';price.textContent='R$ '+fmt(p.price);info.appendChild(price);
        if(p.discount){var discount=document.createElement('span');discount.className='discount';discount.textContent='-'+p.discount+'%';info.appendChild(discount);}
        var old=document.createElement('div');old.className='old';old.textContent=p.discount?'R$ '+fmt(p.oldPrice):'';info.appendChild(old);
        var label=document.createElement('div');label.className='colors';label.textContent=p.category;info.appendChild(label);card.appendChild(info);grid.appendChild(card);
      });
    });
  }
  search.addEventListener('input',render);category.addEventListener('change',render);sort.addEventListener('change',render);render();
})();
