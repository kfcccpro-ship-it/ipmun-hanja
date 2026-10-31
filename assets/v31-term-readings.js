/* v0.31.0 - source: scanned textbook referenceTerms, readings reconstructed separately.
   Reference-term Hanzi are from printed pages 29-52; Hangul readings are NOT
   printed in the adjacent glossary. Parent may correct per-term pronunciations. */
(function(){
 'use strict';
 const EXTRA="入입 夫부 事사 作작 場장 學학 農농 理리 當당 視시 力력 通통 無무 才재 全전 木목 多다 頭두 死사 强강 高고 用용 交교 所소 肉육 急급 向향 末말 成성 合합 利리 物물 話화 心심 意의 行행 立립 石석 計계 內내 安안 平평 老로 語어 遠원 天천 讀독 友우 人인 親친 樂락 生생 下하 別별 訃부 原원 己기 目목 名명 新신 後후 績적 共공 團단 田전 去거 明명 神신 足족 門문 室실 詩시 民민 各각 外외 國국 社사 軍군 家가 部부 毛모 科과 見견 日일 不불 漢한 步보 孝효 面면 上상 線선 海해 活활 形형 地지 等등 時시 口구 車차 村촌 代대 記기 先선 女녀 答답 方방 放방 朝조 開개 百백 命명 身신 靈령 出출 旗기 英영 分분 三삼 會회 便편 古고 辭사 疫역 魔마 床상 登등 士사 大대 水수 船선 山산 夜야 粗조 腹복 寸촌 牛우 手수 首수 色색 位위 韓한 音음 火화 惡악 耳이 和화 每매 林림 男남 小소 育육 半반 質질 銀은 校교 衣의 父부 歲세 空공 態태 靑청 近근 元원 米미 間간 傷상 南남 京경 今금 光광 東동 秋추 子자 世세 王왕 觀관 政정 里리 母모 弱약 豆두 滿만 休휴 夕석 有유 言언 聞문 土토 朱주 馬마 川천 江강 歌가 短단";
 const extras={};EXTRA.split(' ').forEach(function(row){const a=Array.from(row);extras[a[0]]=a.slice(1).join('')});
 // Words needing a sound other than the primary Hanja reading.
 const exception={ '音樂':'음악','樂音':'악음','便所':'변소','便宜':'편의','不在':'부재','不通':'불통','銀行':'은행','樂園':'낙원','樂勝':'낙승'};
 const initial=function(h){
   if(!h||h.length!==1)return h;
   const code=h.charCodeAt(0)-44032;if(code<0||code>11171)return h;
   const initial=Math.floor(code/588),medial=Math.floor(code%588/28),final=code%28;
   const toIeung=[2,3,6,7,12,17,20].includes(medial);
   if(initial===5)return String.fromCharCode(44032+(toIeung?11:2)*588+medial*28+final);
   if(initial===2&&toIeung)return String.fromCharCode(44032+11*588+medial*28+final);
   return h;
 };
 const sound=function(term,overrides){
   if(overrides&&Object.prototype.hasOwnProperty.call(overrides,term)&&overrides[term])return overrides[term];
   const baseWord=typeof DATA!=='undefined'&&DATA.words&&DATA.words.find(w=>w.hanja===term);
   if(baseWord&&baseWord.reading)return baseWord.reading;
   if(exception[term])return exception[term];
   const chars=Array.from(term||'');
   return chars.map(function(ch,i){
     const hanja=typeof CHAR_INFO!=='undefined'&&CHAR_INFO[ch]&&CHAR_INFO[ch].eum||extras[ch]||'';
     return i===0?initial(hanja):hanja;
   }).join('')||null;
 };
 const collection=function(w){
   const seen=new Set(),all=[];
   const charObjs=typeof charsOf==='function'?charsOf(w):[];
   for(const c of charObjs){
     if(!c)continue;
     const info=CHAR_INFO[c.ch]||{};
     const terms=(info.referenceTerms||[]).filter(s=>Array.from(s).length===2);
     const wordItems=[];
     for(const t of terms){
       const key=c.ch+':'+t;
       if(seen.has(key))continue;seen.add(key);
       wordItems.push({word:t,reading:sound(t,window.__hanja31ReadingOverrides||{}),origin:c.ch,page:w.detailPage});
     }
     all.push({character:c.ch,hun:c.hun,eum:c.eum,page:w.detailPage,terms:wordItems});
   }
   return all;
 };
 window.__hanja31TermData={sound,initial,collection,extras,exception};
})();
