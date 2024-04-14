//Run this inside your browsers console, or make a bookmarklet.
function exportJson() {
  const title = getTitle();
  const json = { title: title, tracks: [] };
  let channelId = 0;
  let lastTime = 0;

  function eventTime(time) {
    const diff = time - lastTime;
    lastTime = time;
    return Math.round(diff * 96);
  }

  function createJsonInstrumentTrack(instId) {
    lastTime = 0;
    const baseInstId = instMgr.baseId(instId);
    const instVolume = song.settings.instruments[instId]?.volume || 1;
    let instDetune = song.settings.instruments[instId]?.detune || 0;
    const notes = song.notes.filter(n => n.instrument === instId).map(note => ({
      type: note.type,
      time: note.time,
      length: note.length,
      volume: Math.max(note.volume * instVolume * 50, 0)
    }));
    if (notes.length === 0) return;

    notes.sort((a, b) => a.time < b.time ? -1 : 1);

    const events = [];
    for (const note of notes) {
      events.push([{ time: note.time, type: note.type, isOn: true }, note.volume]);
      events.push([{ time: note.time + note.length, type: note.type, isOn: false }, 0]);
    }

    events.sort((a, b) => {
      if (a[0].time === b[0].time) {
        return a[0].isOn ? 1 : -1;
      }
      return a[0].time < b[0].time ? -1 : 1;
    });

    const track = [];
    let channel;
    if (instMgr.isDrum(instId)) {
      channel = 9;
    } else {
      channel = channelId;
      channelId++;
      if (channelId === 9) {
        channelId++;
      }
    }
    track.push({ trackName: getInstrumentName(song, instId) });
    track.push({ programChangeEvent: settings.midiInstrumentMap[baseInstId] - 1 });

    let map;
    if (baseInstId === 36) {
      map = Midi.drumKit808Map;
    } else if (baseInstId === 39) {
      map = Midi.drumKit8BitMap;
    } else if (baseInstId === 40) {
      map = Midi.drumKit2013Map;
    } else if (baseInstId === 42) {
      map = Midi.drumKit909Map;
    } else {
      map = midiNoteNamesToIndex;
    }

    if (channel === 9) {
      instDetune = 0;
    }

    for (const event of events) {
      const delta = eventTime(event[0].time);
      let pitch = map[event[0].type] + Math.round(instDetune / 100);
      if (map === midiNoteNamesToIndex) pitch -= 12;

      const noteEvent = event[0].isOn ?
        { noteOnEvent: [channel, pitch, event[1]] } :
        { noteOffEvent: [channel, pitch, 0] };
      track.push({ noteEvent: noteEvent, delta: delta });
    }

    track.push({ endOfTrackEvent: true });
    json.tracks.push(track);
  }

  const mpqn = 1 / (bpm / 60) * 1_000_000;
  let first = true;

  for (const instId of new Set(song.notes.map(n => n.instrument))) {
    const track = [];
    if (first) {
      track.push({ timeSignatureEvent: [getTimeSig(), 4] });
      track.push({ setTempoEvent: mpqn });
      first = false;
    }
    createJsonInstrumentTrack(instId);
  }

  const jsonString = JSON.stringify(json);
  saveBlob(title + ".json", [new Uint8Array(Buffer.from(jsonString))], "application/json");
}

exportJson()
