// Source-faithful normalization: 장원한자 교재 필·응편 표기는 氷(얼음 빙)이다.
const _iceWord=DATA.words.find(w=>w.id==='w040');
if(_iceWord){_iceWord.hanja=_iceWord.hanja.replace('冰','氷');for(const d of _iceWord.characterDetails){if(d.char==='冰')d.char='氷';}}
