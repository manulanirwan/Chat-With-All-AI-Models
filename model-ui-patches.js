(()=>{
  const MODELS=[
    ["GPT-6 Astra","OpenAI"],["GPT-5.6 Cyber","OpenAI"],["Claude Fable 5.1","Anthropic"],["Claude Mythos 5.1","Anthropic"],["Claude Opus 5","Anthropic"],["Gemini 3.8 Flash","Google"],["Gemini 3.8 Flash Cyber","Google"],["Grok 4.6","xAI"],["DeepSeek V4.1 Flash","DeepSeek"],["DeepSeek V4 Pro","DeepSeek"],["Qwen3.8-Max","Alibaba"],["Qwen3.8 Flash-Next","Alibaba"],["Kimi K3","Moonshot AI"],["GLM-5.3","Z.ai"],["GLM-5.3 Flash","Z.ai"],["Muse Spark 1.3","Meta"],["Nemotron 3 Ultra","NVIDIA"],["Mistral Medium 3.5","Mistral AI"],["Command A+","Cohere"],["Atria Dawn Preview","Atria"]
  ];
  const esc=v=>String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  const initial=v=>String(v||"AI").replace(/[^A-Za-z]/g,"").slice(0,2).toUpperCase()||"AI";
  let rendering=false;

  function renderDeck(){
    const target=document.querySelector("#featured-models");
    if(!target||rendering||target.children.length===20)return;
    rendering=true;
    target.innerHTML=MODELS.map(([name,company],i)=>`<button class="featured-model model-card" type="button" data-model-name="${esc(name)}"><span class="provider-logo provider-${i+1}">${initial(company)}</span><span class="featured-copy"><b>${esc(name)}</b><small>${esc(company)}</small></span><span class="model-index">${String(i+1).padStart(2,"0")}</span></button>`).join("");
    target.querySelectorAll("[data-model-name]").forEach(button=>button.addEventListener("click",()=>choose(button.dataset.modelName)));
    rendering=false;
  }

  function choose(name){
    const picker=document.querySelector("#model-picker");
    if(!picker)return;
    picker.click();
    const pick=()=>{
      const match=[...document.querySelectorAll("#model-list .model-option")].find(b=>b.textContent.includes(name)&&!b.disabled);
      if(match){match.click();return true}
      return false;
    };
    if(!pick()){window.setTimeout(pick,180);window.setTimeout(pick,480)}
  }

  function syncHero(){
    const label=document.querySelector("#model-label"),name=document.querySelector("#console-model-name"),company=document.querySelector("#console-model-company");
    const selected=label?.textContent.trim()||"GPT-6 Astra";
    if(name)name.textContent=selected;
    const item=MODELS.find(m=>m[0]===selected);
    if(company)company.textContent=item?.[1]||"AI";
  }

  function bind(){
    document.querySelector("#hero-models")?.addEventListener("click",()=>document.querySelector("#model-picker")?.click());
    document.querySelector("#hero-settings")?.addEventListener("click",()=>document.querySelector("#top-settings")?.click());
    document.querySelector("#side-browse-models")?.addEventListener("click",()=>document.querySelector("#model-picker")?.click());
    renderDeck();syncHero();
    const deck=document.querySelector("#featured-models");
    if(deck)new MutationObserver(()=>renderDeck()).observe(deck,{childList:true});
    const label=document.querySelector("#model-label");
    if(label)new MutationObserver(syncHero).observe(label,{characterData:true,childList:true,subtree:true});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
