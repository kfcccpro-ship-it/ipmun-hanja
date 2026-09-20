/* v0.21 parent learning picker: printed textbook pages 29-52 are the primary learning DB */
(function(){
  window.pDailyRange = function(v){
    var pages = Array.from({length:24}, function(_,i){return 29+i});
    var saved = (db.dailyScope && db.dailyScope.wordIds) ? db.dailyScope.wordIds.map(Number) : [];
    var selected = new Set(saved);
    var active = (db.dailyScope && db.dailyScope.activePage >= 29 && db.dailyScope.activePage <= 52)
      ? db.dailyScope.activePage
      : (selected.size ? ((byId(Array.from(selected)[0])||{}).detailPage || 29) : 29);

    function pageWords(p){ return uniqWords(ITEMS.filter(function(d){return d.detailPage===p})) }
    function pageIds(p){ return pageWords(p).map(function(w){return w.id}) }
    function allOn(p){ var ids=pageIds(p); return ids.length && ids.every(function(id){return selected.has(id)}) }
    function someOn(p){ return pageIds(p).some(function(id){return selected.has(id)}) }
    function esc(x){ return String(x==null?'':x).replace(/[&<>"']/g,function(m){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]}) }

    function paint(){
      var words=pageWords(active);
      var chosen=Array.from(selected).map(byId).filter(Boolean).sort(function(a,b){
        return (a.detailPage-b.detailPage)||(a.id-b.id);
      });
      var pageHtml=pages.map(function(p){
        var state=allOn(p)?'all':(someOn(p)?'some':'');
        var label=allOn(p)?'전체 선택':(someOn(p)?'일부 선택':'4단어');
        return '<button class="pagePick '+(p===active?'active ':'')+state+'" data-page="'+p+'"><b>'+p+'</b><small>'+label+'</small></button>';
      }).join('');
      var wordHtml=words.map(function(w){
        var on=selected.has(w.id), cs=charsOf(w);
        var chars=cs.map(function(c){
          return '<button class="hanjaPick '+(on?'selected':'')+'" data-word="'+w.id+'" title="'+esc(c.hun+' '+c.eum)+'"><b class="hz">'+esc(c.ch)+'</b><small>['+esc(c.hun+' '+c.eum)+']</small><em>'+c.hoek+'획</em></button>';
        }).join('');
        return '<div class="wordPick '+(on?'selected':'')+'" data-word-card="'+w.id+'"><div class="wordPickTitle"><b class="hz">'+esc(w.word)+'</b><span>'+esc(w.read)+'</span></div><div class="hanjaPickRow">'+chars+'</div></div>';
      }).join('');
      var chosenPages=Array.from(new Set(chosen.map(function(w){return w.detailPage})));
      var chosenHtml=chosen.map(function(w){
        return '<span><b class="hz">'+esc(w.word)+'</b><small>'+esc(w.read)+' · '+w.detailPage+'쪽</small></span>';
      }).join('');

      v.innerHTML =
        '<div class="card">'+
          '<div class="row" style="justify-content:space-between;align-items:flex-start">'+
            '<div><h3 style="margin:0">하루 학습 선택 · 교재 29~52쪽</h3>'+
            '<p class="muted" style="margin:5px 0 0">페이지 전체 또는 한자/단어를 눌러 오늘 배울 범위를 고릅니다.</p></div>'+
            '<button class="ghost" id="dailyClear">전체 해제</button>'+
          '</div>'+
          '<div class="pagePickGrid">'+pageHtml+'</div>'+
          '<div class="pageDetailPick">'+
            '<div class="row" style="justify-content:space-between"><h3 style="margin:0">'+active+'쪽</h3>'+
            '<button class="'+(allOn(active)?'no':'sun')+'" id="togglePage">'+(allOn(active)?'이 페이지 해제':'이 페이지 4단어 선택')+'</button></div>'+
            '<div class="wordPickGrid">'+wordHtml+'</div>'+
          '</div>'+
          '<div class="dailySelectionBar">'+
            '<div><b>'+chosen.length+'단어 · '+(chosen.length*2)+'자 선택</b><span>'+(chosenPages.length?chosenPages.map(function(p){return p+'쪽'}).join(' · '):'선택 없음')+'</span></div>'+
            '<button class="pri" id="saveDailyPick" '+(chosen.length?'':'disabled')+'>오늘 학습으로 저장</button>'+
          '</div>'+
          (chosen.length?'<details class="pickedList"><summary>선택한 단어 보기</summary><div class="scopeWords">'+chosenHtml+'</div></details>':'')+
        '</div>';

      v.querySelectorAll('[data-page]').forEach(function(b){
        b.onclick=function(){
          active=Number(b.dataset.page);
          var ids=pageIds(active), all=ids.every(function(id){return selected.has(id)});
          ids.forEach(function(id){ if(all)selected.delete(id); else selected.add(id); });
          paint();
        };
      });
      v.querySelectorAll('[data-word]').forEach(function(b){
        b.onclick=function(e){
          e.stopPropagation();
          var id=Number(b.dataset.word);
          if(selected.has(id))selected.delete(id);else selected.add(id);
          paint();
        };
      });
      v.querySelectorAll('[data-word-card]').forEach(function(card){
        card.onclick=function(e){
          if(e.target.closest('button'))return;
          var id=Number(card.dataset.wordCard);
          if(selected.has(id))selected.delete(id);else selected.add(id);
          paint();
        };
      });
      document.querySelector('#togglePage').onclick=function(){
        var ids=pageIds(active), all=ids.every(function(id){return selected.has(id)});
        ids.forEach(function(id){ if(all)selected.delete(id); else selected.add(id); });
        paint();
      };
      document.querySelector('#dailyClear').onclick=function(){selected.clear();paint()};
      document.querySelector('#saveDailyPick').onclick=function(){
        var ids=Array.from(selected).sort(function(a,b){
          var A=byId(a),B=byId(b);
          return ((A&&A.detailPage)||0)-((B&&B.detailPage)||0) || a-b;
        });
        if(!ids.length)return toast('학습할 단어를 선택해 주세요');
        db.dailyScope={wordIds:ids,activePage:active,source:'detail-pages-29-52'};
        db.sess=null;
        save();
        toast(ids.length+'단어 · '+(ids.length*2)+'자를 오늘 학습으로 저장했습니다');
        paint();
      };
    }
    paint();
  };
})();