$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$FfmpegCommand = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
if ($FfmpegCommand) { $Ffmpeg = $FfmpegCommand.Source } else { $Ffmpeg = 'C:\Users\erohi\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe' }
$Ffprobe = Join-Path (Split-Path $Ffmpeg) 'ffprobe.exe'
$Assets = Join-Path $Root 'assets'
$Voice = Join-Path $Root 'voiceover-final.wav'
$Music = Join-Path $Root 'score.wav'
$Captions = Join-Path $Root 'captions.ass'
$Output = Join-Path $Root 'Zuma_Ravi_Synthetic_Demo_45s.mp4'

if (-not (Test-Path -LiteralPath $Ffmpeg)) { throw "FFmpeg not found: $Ffmpeg" }
if (-not (Test-Path -LiteralPath $Ffprobe)) { throw "FFprobe not found beside FFmpeg: $Ffprobe" }
$SceneSpecs = @(
  @{ Name = '01-identity-review-1920x1080.png'; Seconds = 6.5 },
  @{ Name = '02-consent-24h-1920x1080.png'; Seconds = 7.0 },
  @{ Name = '03-source-comparison-1920x1080.png'; Seconds = 10.0 },
  @{ Name = '04-source-linked-summary-1920x1080.png'; Seconds = 10.5 },
  @{ Name = '06-clinician-review-1920x1080.png'; Seconds = 11.0 }
)
$Scenes = foreach ($Spec in $SceneSpecs) {
  $File = Join-Path $Assets $Spec.Name
  if (-not (Test-Path -LiteralPath $File)) { throw "Missing video still: $File" }
  [pscustomobject]@{ File = $File; Seconds = [double]$Spec.Seconds }
}
foreach ($File in @($Voice, $Music, $Captions)) {
  if (-not (Test-Path -LiteralPath $File)) { throw "Missing input: $File" }
}

$VoiceProbe = (& $Ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $Voice | Out-String).Trim()
$VoiceDuration = [double]::Parse($VoiceProbe, [Globalization.CultureInfo]::InvariantCulture)
$VoiceTarget = 43.5
$Tempo = [math]::Max(1.0, $VoiceDuration / $VoiceTarget)
if ($Tempo -gt 1.08) { throw "Voiceover is $VoiceDuration seconds. Regenerate a shorter take; this script limits tempo correction to 8%." }
$TempoText = $Tempo.ToString('0.###', [Globalization.CultureInfo]::InvariantCulture)

$InputArgs = [System.Collections.Generic.List[string]]::new()
foreach ($Scene in $Scenes) {
  $DurationText = $Scene.Seconds.ToString('0.###', [Globalization.CultureInfo]::InvariantCulture)
  $InputArgs.AddRange([string[]]@('-loop', '1', '-framerate', '30', '-t', $DurationText, '-i', $Scene.File))
}
$InputArgs.AddRange([string[]]@('-i', $Voice, '-i', $Music))

$Graph = [System.Collections.Generic.List[string]]::new()
for ($i = 0; $i -lt $Scenes.Count; $i++) {
  $DurationText = $Scenes[$i].Seconds.ToString('0.###', [Globalization.CultureInfo]::InvariantCulture)
  $Graph.Add("[$i`:v]scale=1920:1080:flags=lanczos,setsar=1,zoompan=z='min(1+on*0.00012,1.035)':d=1:s=1920x1080:fps=30:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',trim=duration=$DurationText,setpts=PTS-STARTPTS[v$i]")
}
$Graph.Add('[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0,ass=captions.ass,format=yuv420p[v]')
$Graph.Add("[5:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,atempo=$TempoText,apad=pad_dur=45,atrim=duration=45,volume=0.92[voice]")
$Graph.Add('[6:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,atrim=duration=45,afade=t=in:st=0:d=1.2,afade=t=out:st=42:d=3,volume=0.16[music]')
$Graph.Add('[voice][music]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95,atrim=duration=45[a]')
$FilterComplex = $Graph -join ';'

Push-Location $Root
try {
  & $Ffmpeg -hide_banner -y @InputArgs -filter_complex $FilterComplex -map '[v]' -map '[a]' -t 45 -frames:v 1350 -r 30 -fps_mode cfr -c:v libx264 -preset slow -crf 18 -profile:v high -level:v 4.0 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -movflags +faststart -metadata 'title=ZUMA - Ravi synthetic local demo' -metadata 'comment=Fictional records only; no live hospital or ABDM connection.' $Output
  if ($LASTEXITCODE -ne 0) { throw "FFmpeg exited with code $LASTEXITCODE" }
} finally {
  Pop-Location
}

$FormatProbe = (& $Ffprobe -v error -show_entries format=duration,size -of json $Output | Out-String) | ConvertFrom-Json
$VideoProbe = (& $Ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,avg_frame_rate,nb_frames -of json $Output | Out-String) | ConvertFrom-Json
$RenderedDuration = [double]::Parse([string]$FormatProbe.format.duration, [Globalization.CultureInfo]::InvariantCulture)
$VideoStream = $VideoProbe.streams[0]
if ($RenderedDuration -lt 44.95 -or $RenderedDuration -gt 45.05) { throw "Unexpected render duration: $RenderedDuration seconds" }
if ($VideoStream.width -ne 1920 -or $VideoStream.height -ne 1080 -or $VideoStream.avg_frame_rate -ne '30/1') { throw 'Render is not 1920x1080 at 30 fps.' }
Write-Output "RENDER_OK=$Output"
Write-Output "DURATION=$RenderedDuration`
RESOLUTION=$($VideoStream.width)x$($VideoStream.height)`nFPS=$($VideoStream.avg_frame_rate)`nFRAMES=$($VideoStream.nb_frames)`nBYTES=$($FormatProbe.format.size)`nVOICE_SECONDS=$VoiceDuration`nVOICE_ATEMPO=$TempoText"
