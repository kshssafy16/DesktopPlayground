# Windows foreground/taskbar reorder notifications only. The Electron process
# owns all windows and decides whether a reported ordering needs repair.
Add-Type @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class TaskbarZOrderWatch {
  private const uint EVENT_SYSTEM_FOREGROUND = 0x0003;
  private const uint EVENT_OBJECT_REORDER = 0x8004;
  private const uint WINEVENT_OUTOFCONTEXT = 0x0000;
  private const uint GW_HWNDNEXT = 2;
  private const uint GA_ROOT = 2;
  private delegate void WinEventProc(IntPtr hook, uint eventType, IntPtr hwnd,
    int objectId, int childId, uint eventThread, uint eventTime);

  [StructLayout(LayoutKind.Sequential)]
  private struct Message {
    public IntPtr hwnd;
    public uint message;
    public IntPtr wParam;
    public IntPtr lParam;
    public uint time;
    public int x;
    public int y;
    public uint lPrivate;
  }

  [DllImport("user32.dll")] private static extern IntPtr SetWinEventHook(uint minimum,
    uint maximum, IntPtr module, WinEventProc callback, uint processId,
    uint threadId, uint flags);
  [DllImport("user32.dll")] private static extern bool UnhookWinEvent(IntPtr hook);
  [DllImport("user32.dll")] private static extern int GetMessage(out Message message,
    IntPtr window, uint minimum, uint maximum);
  [DllImport("user32.dll")] private static extern bool TranslateMessage(ref Message message);
  [DllImport("user32.dll")] private static extern IntPtr DispatchMessage(ref Message message);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern IntPtr FindWindow(string className, string title);
  [DllImport("user32.dll")] private static extern IntPtr GetTopWindow(IntPtr window);
  [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr window, uint command);
  [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr window, uint flags);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  private static extern int GetClassName(IntPtr window, StringBuilder name, int length);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(
    IntPtr window, out uint processId);

  private static IntPtr overlay;
  private static IntPtr taskbar;
  private static WinEventProc callback;
  private static Timer settle;

  private static bool IsSystemSurface(IntPtr window) {
    if (window == IntPtr.Zero) return true;
    var root = GetAncestor(window, GA_ROOT);
    var name = new StringBuilder(128);
    GetClassName(root, name, name.Capacity);
    if (name.ToString() == "Shell_TrayWnd" ||
        name.ToString() == "Shell_SecondaryTrayWnd") return true;
    uint processId;
    GetWindowThreadProcessId(root, out processId);
    try {
      var process = Process.GetProcessById((int)processId).ProcessName;
      return process.Equals("ScreenClippingHost", StringComparison.OrdinalIgnoreCase) ||
        process.Equals("SnippingTool", StringComparison.OrdinalIgnoreCase) ||
        process.Equals("StartMenuExperienceHost", StringComparison.OrdinalIgnoreCase) ||
        process.Equals("ShellExperienceHost", StringComparison.OrdinalIgnoreCase) ||
        process.Equals("SearchHost", StringComparison.OrdinalIgnoreCase) ||
        process.Equals("LockApp", StringComparison.OrdinalIgnoreCase);
    } catch { return false; }
  }

  private static void CheckOrder(object ignored) {
    var foreground = GetForegroundWindow();
    if (foreground == overlay || IsSystemSurface(foreground)) return;
    taskbar = FindWindow("Shell_TrayWnd", null);
    if (taskbar == IntPtr.Zero) return;
    int taskbarRank = -1, overlayRank = -1;
    var window = GetTopWindow(IntPtr.Zero);
    for (int rank = 0; window != IntPtr.Zero && rank < 4096; rank++) {
      if (window == taskbar) taskbarRank = rank;
      if (window == overlay) overlayRank = rank;
      if (taskbarRank >= 0 && overlayRank >= 0) break;
      window = GetWindow(window, GW_HWNDNEXT);
    }
    if (taskbarRank >= 0 && overlayRank >= 0 && taskbarRank < overlayRank) {
      Console.WriteLine("restore");
      Console.Out.Flush();
    }
  }

  public static void Run(long overlayHandle) {
    overlay = new IntPtr(overlayHandle);
    taskbar = FindWindow("Shell_TrayWnd", null);
    settle = new Timer(CheckOrder, null, Timeout.Infinite, Timeout.Infinite);
    callback = (hook, eventType, window, objectId, childId, eventThread, eventTime) => {
      if (eventType == EVENT_SYSTEM_FOREGROUND ||
          (eventType == EVENT_OBJECT_REORDER && window == taskbar))
        settle.Change(180, Timeout.Infinite);
    };
    var foregroundHook = SetWinEventHook(EVENT_SYSTEM_FOREGROUND,
      EVENT_SYSTEM_FOREGROUND, IntPtr.Zero, callback, 0, 0, WINEVENT_OUTOFCONTEXT);
    var reorderHook = SetWinEventHook(EVENT_OBJECT_REORDER,
      EVENT_OBJECT_REORDER, IntPtr.Zero, callback, 0, 0, WINEVENT_OUTOFCONTEXT);
    if (foregroundHook == IntPtr.Zero || reorderHook == IntPtr.Zero)
      throw new InvalidOperationException("Could not subscribe to Windows z-order events");
    new Thread(() => { Console.In.ReadLine(); Environment.Exit(0); }) {
      IsBackground = true
    }.Start();
    Console.WriteLine("ready");
    Console.Out.Flush();
    Message message;
    while (GetMessage(out message, IntPtr.Zero, 0, 0) > 0) {
      TranslateMessage(ref message);
      DispatchMessage(ref message);
    }
    UnhookWinEvent(foregroundHook);
    UnhookWinEvent(reorderHook);
    settle.Dispose();
  }
}
'@
[TaskbarZOrderWatch]::Run($OverlayHandle)
