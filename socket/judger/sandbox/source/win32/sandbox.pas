{
        This code was provided by Kien Nguyen Tien Trung (@kc97ble)
        Implements a sandbox on Windows, using a JobObject (therefore,
        not supported on Windows Vista or lower)
}

{$mode objfpc}
{$assertions on}
{$hints on}
{$H+}

uses windows, classes, sysutils, jwawinbase, jwawinnt, JwaWinType, dateutils;

function SetJobMemoryLimit(JobObject: THandle; JobMemoryLimit: SIZE_T): boolean;
var
  Info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION;
begin
  if not QueryInformationJobObject(JobObject, JobObjectExtendedLimitInformation,
    @Info, sizeof(Info), nil) then exit(False);
  Info.JobMemoryLimit:=JobMemoryLimit;
  with Info.BasicLimitInformation do LimitFlags := LimitFlags or JOB_OBJECT_LIMIT_JOB_MEMORY;
  Result := SetInformationJobObject(JobObject, JobObjectExtendedLimitInformation,
    @Info, sizeof(Info));
end;

function PeakJobMemoryUsed(JobObject: THandle): SIZE_T;
var
  Info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION;
begin
  if not QueryInformationJobObject(JobObject, JobObjectExtendedLimitInformation,
    @Info, sizeof(Info), nil) then exit(0);
  Result := Info.PeakJobMemoryUsed;
end;

function AssignCurrentProcessToJobObject(JobObject: THandle): Boolean;
var
  HProcess: THandle;
begin
  HProcess := OpenProcess(PROCESS_ALL_ACCESS, false, GetCurrentProcessID());
  Result := AssignProcessToJobObject(JobObject, HProcess);
end;

type
  TVerdict = (runOK, runRE, runTLE, runMLE, runFAILED);

function ExecuteProcessWait(CommandLine: String; dwMilliseconds: DWORD;
  CurrentDirectory: String): TVerdict;
var
  FProcessInformation : PROCESS_INFORMATION;
  FStartupInfo : STARTUPINFO;
  ExitStatus: DWORD;
  StartTime: TDateTime;
begin
  ZeroMemory(@FProcessInformation, SizeOf(FProcessInformation));
  ZeroMemory(@FStartupInfo, SizeOf(FStartupInfo));
  StartTime := sysutils.Time;
  If Not CreateProcess(nil, PChar(CommandLine), nil, nil, false, 0, nil,
    PChar(CurrentDirectory), FStartupInfo, FProcessInformation) then
  exit(runFAILED);

  case WaitForSingleObject (FProcessInformation.hProcess, dwMilliseconds) of
    0: Result := runOK;
    WAIT_TIMEOUT: Result := runTLE;
  else
    Result := runFAILED;
  end;
  TerminateProcess(FProcessInformation.hProcess, 1);
  writeln(stderr, 'EXECUTION_TIME=', MilliSecondsBetween(sysutils.Time, StartTime));

  if Result=runOK then
  begin
    if not GetExitCodeProcess(FProcessInformation.hProcess, ExitStatus) then
      Result := runFAILED
    else if ExitStatus<>0 then
      Result := runRE;
  end;
end;

function VerdictToString(Verdict: TVerdict): String;
begin
  case Verdict of
    runOK: Result := 'OK';
    runRE: Result := 'RTE';
    runTLE: Result := 'TLE';
    runMLE: Result := 'MLE';
    runFAILED: Result := 'FAILED';
  end;
end;

function IndexOfParameter(Key: String): Integer;
var
  i: Integer;
begin
  for i := 1 to ParamCount do
  if ParamStr(i)=Key then exit(i);
  exit(0);
end;

function IndexOfParameter(Keys: array of String): Integer;
var
  i: Integer;
  Key: String;
begin
  for i := 1 to ParamCount do
  for Key in Keys do
  if ParamStr(i)=Key then exit(i);
  exit(0);
end;

function GetOptionalParameter(Key: String; Default: String=''): String;
var
  Index: Integer;
begin
  Index := IndexOfParameter(Key);
  if (Index<>0) and (Index<ParamCount) then
    exit(ParamStr(Index+1));
  exit(Default);
end;

function GetPositionalParameter(Index: Integer; Default: String=''): String;
var
  Ignored: Boolean = false;
  i: Integer;
begin
  if Index=0 then exit(ParamStr(0));
  for i := 1 to ParamCount do
  if Ignored then
    Ignored := false
  else if (Length(ParamStr(i))>=2) and (ParamStr(i)[1]='-') then
    Ignored := true
  else if Index>1 then
    Index := Index - 1
  else
    exit(ParamStr(i));
  exit(Default);
end;

procedure ShowHelp;
begin
  writeln('Usage: runner [OPTION]... COMMANDLINE');
  writeln('Run COMMANDLINE with specified limits');
  writeln;
  writeln('-m BYTES':20, '':5, 'Memory limit (in bytes)');
  writeln('-t MS': 20, '':5, 'Time limit (in milliseconds)');
end;

var
  CommandLine: String;
  JobObject: THandle;
  ML, TL: QWord;
  Verdict: TVerdict;
  CD: String;

begin
  if (IndexOfParameter(['-h', '-?', '--help'])<>0) or (ParamCount=0) then
  begin ShowHelp; halt(1); end;

  JobObject := CreateJobObject(nil, 'JobObject');
  Assert(AssignCurrentProcessToJobObject(JobObject), 'ASSIGN FAILED');

  ML := StrToQWordDef(GetOptionalParameter('-m'), 0);
  Assert((ML=0) or SetJobMemoryLimit(JobObject, ML), 'SET MEMORY LIMIT FAILED');
  TL := StrToQWordDef(GetOptionalParameter('-t'), INFINITE);
  CD := GetOptionalParameter('-d', GetCurrentDir);

  if ML<>0 then writeln(stderr, 'ML=', ML);
  if TL<>INFINITE then writeln(stderr, 'TL=', TL);
  writeln(stderr, 'CD=', CD);

  try
    CommandLine := GetPositionalParameter(1);
    if CommandLine<>'' then
      writeln(stderr, 'COMMANDLINE=', CommandLine)
    else begin
      writeln(stderr, 'MISSING COMMANDLINE');
      writeln(stderr, 'USE --help FOR MORE INFORMATION');
      halt(1);
    end;

    Verdict := ExecuteProcessWait(CommandLine, TL, CD);
	  writeln(stderr, 'MEMORY_USED=', PeakJobMemoryUsed(JobObject));
    writeln(stderr, 'VERDICT=', VerdictToString(Verdict));
  finally
    if Ord(Verdict) > 0 then
      begin
        TerminateJobObject(JobObject, 1);
        CloseHandle(JobObject);
      end;
    halt(Ord(Verdict));
  end;
end.
