(()=>{
  const MODELS=[
    ["GPT-6 Astra","OpenAI"],["GPT-5.6 Cyber","OpenAI"],["Claude Fable 5.1","Anthropic"],["Claude Mythos 5.1","Anthropic"],["Claude Opus 5","Anthropic"],["Gemini 3.8 Flash","Google"],["Gemini 3.8 Flash Cyber","Google"],["Grok 4.6","xAI"],["DeepSeek V4.1 Flash","DeepSeek"],["DeepSeek V4 Pro","DeepSeek"],["Qwen3.8-Max","Alibaba"],["Qwen3.8 Flash-Next","Alibaba"],["Kimi K3","Moonshot AI"],["GLM-5.3","Z.ai"],["GLM-5.3 Flash","Z.ai"],["Muse Spark 1.3","Meta"],["Nemotron 3 Ultra","NVIDIA"],["Mistral Medium 3.5","Mistral AI"],["Command A+","Cohere"],["Atria Dawn Preview","Atria"]
  ];
  const esc=v=>String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  const initial=v=>String(v||"AI").replace(/[^A-Za-z]/g,"").slice(0,2).toUpperCase()||"AI";
  const providerSlug=v=>({"OpenAI":"openai","Anthropic":"anthropic","Google":"google","xAI":"xai","DeepSeek":"deepseek","Alibaba":"alibaba","Moonshot AI":"moonshot","Z.ai":"zai","Meta":"meta","NVIDIA":"nvidia","Mistral AI":"mistral","Cohere":"cohere","Atria":"atria"}[v]||"other");
  let rendering=false;

  function selectedName(){return document.querySelector("#model-label")?.textContent.trim()||"GPT-6 Astra";}

  function syncSelected(){
    const selected=selectedName();
    document.querySelectorAll("#featured-models [data-model-name]").forEach(button=>{
      const active=button.dataset.modelName===selected;
      button.classList.toggle("selected",active);
      button.setAttribute("aria-pressed",String(active));
    });
  }

  function renderDeck(){
    const target=document.querySelector("#featured-models");
    if(!target||rendering||target.children.length===20)return;
    rendering=true;
    target.innerHTML=MODELS.map(([name,company],i)=>`<button class="featured-model provider-${providerSlug(company)}" type="button" data-model-name="${esc(name)}" aria-pressed="false"><span class="provider-logo">${initial(company)}</span><span class="featured-copy"><b>${esc(name)}</b><small>${esc(company)}</small></span><span class="model-index">${String(i+1).padStart(2,"0")}</span></button>`).join("");
    target.querySelectorAll("[data-model-name]").forEach(button=>button.addEventListener("click",()=>choose(button.dataset.modelName)));
    syncSelected();
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
    syncSelected();
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
  function keepWelcomeInView(){
    const scroll=document.querySelector("#scroll");
    const messages=document.querySelector("#messages");
    if(!scroll)return;
    const hasMessages=Boolean(messages&&messages.children.length);
    if(!hasMessages)scroll.scrollTop=0;
  }
  function start(){
    bind();
    keepWelcomeInView();
    const messages=document.querySelector("#messages");
    if(messages)new MutationObserver(keepWelcomeInView).observe(messages,{childList:true});
    window.setTimeout(keepWelcomeInView,80);
    window.setTimeout(keepWelcomeInView,400);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
