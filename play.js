(async()=>{
 const id=location.pathname.split("/").filter(Boolean).pop(),$=s=>document.querySelector(s);
 const headline=$("#headline"),caption=$("#caption"),stage=$("#mediaStage"),popups=$("#popups"),bar=$("#bar"),timer=$("#timer");
 let prank;try{const r=await fetch("/api/pranks/"+encodeURIComponent(id));if(!r.ok)throw Error();prank=await r.json()}catch{headline.textContent="Link indisponível";caption.textContent="Peça um novo link a quem enviou.";return}
 const total=prank.duration*1000,started=Date.now(),rates={leve:6500,media:4200,forte:2800,insana:1900},delay=rates[prank.intensity]||4200;
 const messages=["Você foi selecionado! 🏆","Oferta imperdível de memes!","Atenção: excesso de zoeira 😂","Seu celular está oficialmente rindo.","Última chance de escapar... brincadeira!"];
 let index=0,closed=false;
 function showItem(){if(!prank.items.length){stage.innerHTML='<div class="emoji">🤣</div><h2>MEME DETECTADO!</h2><p>'+messages[index%messages.length]+'</p>';return}
 const item=prank.items[index%prank.items.length];stage.innerHTML="";
 const el=document.createElement(item.type==="video"?"video":"img");el.src=item.url;el.className="media";
 if(item.type==="video"){el.controls=true;el.autoplay=true;el.muted=true;el.loop=true;el.playsInline=true}else el.alt="Imagem da pegadinha";
 stage.appendChild(el);
 }
 function popup(){if(closed)return;const p=document.createElement("div");p.className="popup";p.innerHTML='<b>📢 ANÚNCIO DE ZOEIRA</b><span></span><button aria-label="Fechar">×</button>';p.querySelector("span").textContent=messages[index%messages.length];p.querySelector("button").onclick=()=>p.remove();popups.appendChild(p);setTimeout(()=>p.remove(),2600);while(popups.children.length>3)popups.firstChild.remove()}
 function finish(){if(closed)return;closed=true;clearInterval(loop);$("#end").hidden=false}
 $("#exit").onclick=finish;
 const revealDelay=Math.min(prank.revealAfter||30,prank.duration)*1000;
 setTimeout(()=>{if(!closed){$("#magicReveal").hidden=false;$("#magicReveal").textContent="🔑 Palavra mágica: "+prank.secret;$("#magicHint").textContent="Digite a palavra mágica para encerrar a brincadeira.";$("#magic").focus()}},revealDelay);
 $("#unlock").onclick=()=>{if($("#magic").value.trim().toLocaleUpperCase("pt-BR")===prank.secret.trim().toLocaleUpperCase("pt-BR"))finish();else alert("Ainda não é a palavra mágica. Você também pode usar Sair da brincadeira.")};
 $("#magic").addEventListener("keydown",e=>{if(e.key==="Enter")$("#unlock").click()});
 headline.textContent=prank.title;caption.textContent="Prepare-se para uma sequência de surpresas!";showItem();
 const loop=setInterval(()=>{if(closed)return;const elapsed=Date.now()-started,remaining=Math.max(0,total-elapsed);bar.style.width=(elapsed/total*100)+"%";timer.textContent="Tempo da brincadeira: "+Math.ceil(remaining/1000)+"s";if(elapsed>=total){finish();return}index++;showItem();popup()},delay);
 setTimeout(()=>{if(!closed)popup()},500);
})();
