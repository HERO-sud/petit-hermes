"""VOICEVOX合成ヘルパー。 engine(:50021)が起動している前提。
使い方: from voicevox_say import synth; synth("こんにちは","ずんだもん","/tmp/o.wav")"""
import requests
BASE="http://127.0.0.1:50021"
SPK={"四国めたん":2,"ずんだもん":3,"雨晴はう":10,"metan":2,"zunda":3,"hau":10}
def synth(text, who, path=None, speed=1.0, pitch=0.0, intonation=1.0):
    sid=SPK[who]
    q=requests.post(f"{BASE}/audio_query",params={"text":text,"speaker":sid},timeout=60).json()
    q["speedScale"]=speed; q["pitchScale"]=pitch; q["intonationScale"]=intonation
    wav=requests.post(f"{BASE}/synthesis",params={"speaker":sid},json=q,timeout=120).content
    if path: open(path,"wb").write(wav)
    return wav
