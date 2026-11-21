// Remove demo seed and make app start with no stored groups/members/expenses.
(function(){
  const KEY='fen-zhang-helper-v1';
  try{
    const stored=JSON.parse(localStorage.getItem(KEY)||'null');
    if(!stored || !Array.isArray(stored.groups)) localStorage.setItem(KEY,JSON.stringify({groups:[],activeGroupId:null}));
  }catch(_){localStorage.setItem(KEY,JSON.stringify({groups:[],activeGroupId:null}));}
})();
