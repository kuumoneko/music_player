using System;
using System.IO;
using System.Runtime.InteropServices;

const uint RT_ICON = 3;
const uint RT_GROUP_ICON = 14;

if (args.Length < 2)
{
    Console.Error.WriteLine("Usage: StampIcon <exe> <ico>");
    return 1;
}

string exePath = Path.GetFullPath(args[0]);
string icoPath = Path.GetFullPath(args[1]);

if (!File.Exists(exePath)) { Console.Error.WriteLine($"EXE not found: {exePath}"); return 1; }
if (!File.Exists(icoPath)) { Console.Error.WriteLine($"ICO not found: {icoPath}"); return 1; }

byte[] icoBytes = File.ReadAllBytes(icoPath);
if (icoBytes.Length < 6) { Console.Error.WriteLine("ICO file too small"); return 1; }

ushort reserved = BitConverter.ToUInt16(icoBytes, 0);
ushort type = BitConverter.ToUInt16(icoBytes, 2);
ushort count = BitConverter.ToUInt16(icoBytes, 4);

if (type != 1) { Console.Error.WriteLine($"Not an ICO file (type={type})"); return 1; }
Console.WriteLine($"ICO: {count} icons");

var hUpdate = BeginUpdateResourceW(exePath, bDeleteExistingResources: false);
if (hUpdate == IntPtr.Zero || hUpdate == (IntPtr)(-1))
{
    Console.Error.WriteLine($"BeginUpdateResource failed: {Marshal.GetLastWin32Error()}");
    return 1;
}

try
{
    // Build GROUP_ICON data: ICONDIR header + count ICONDIRENTRY (14-byte entries with ID instead of offset)
    int groupSize = 6 + count * 14;
    byte[] groupData = new byte[groupSize];
    BitConverter.GetBytes((ushort)0).CopyTo(groupData, 0); // reserved
    BitConverter.GetBytes((ushort)1).CopyTo(groupData, 2); // type = RT_ICON
    BitConverter.GetBytes(count).CopyTo(groupData, 4);

    for (int i = 0; i < count; i++)
    {
        int entryOffset = 6 + i * 16;
        byte width = icoBytes[entryOffset + 0];
        byte height = icoBytes[entryOffset + 1];
        byte colorCount = icoBytes[entryOffset + 2];
        byte reserved2 = icoBytes[entryOffset + 3];
        ushort planes = BitConverter.ToUInt16(icoBytes, entryOffset + 4);
        ushort bitCount = BitConverter.ToUInt16(icoBytes, entryOffset + 6);
        uint bytesInRes = BitConverter.ToUInt32(icoBytes, entryOffset + 8);
        uint imageOffset = BitConverter.ToUInt32(icoBytes, entryOffset + 12);

        ushort resourceId = (ushort)(i + 1);

        // Add individual RT_ICON resource
        IntPtr iconData = Marshal.AllocHGlobal((int)bytesInRes);
        Marshal.Copy(icoBytes, (int)imageOffset, iconData, (int)bytesInRes);

        bool ok = UpdateResourceW(hUpdate, RT_ICON, (IntPtr)resourceId, 0x0409, iconData, bytesInRes);
        Marshal.FreeHGlobal(iconData);

        if (!ok)
        {
            Console.Error.WriteLine($"UpdateResource RT_ICON #{resourceId} failed: {Marshal.GetLastWin32Error()}");
            return 1;
        }
        Console.WriteLine($"  RT_ICON #{resourceId}: {bytesInRes} bytes ({width}x{height} {bitCount}bpp)");

        // Write 14-byte ICONDIRENTRY to group (ID replaces offset)
        int groupEntryOffset = 6 + i * 14;
        groupData[groupEntryOffset + 0] = width;
        groupData[groupEntryOffset + 1] = height;
        groupData[groupEntryOffset + 2] = colorCount;
        groupData[groupEntryOffset + 3] = reserved2;
        BitConverter.GetBytes(planes).CopyTo(groupData, groupEntryOffset + 4);
        BitConverter.GetBytes(bitCount).CopyTo(groupData, groupEntryOffset + 6);
        BitConverter.GetBytes(bytesInRes).CopyTo(groupData, groupEntryOffset + 8);
        BitConverter.GetBytes(resourceId).CopyTo(groupData, groupEntryOffset + 12);
    }

    // Add RT_GROUP_ICON resource
    IntPtr groupPtr = Marshal.AllocHGlobal(groupSize);
    Marshal.Copy(groupData, 0, groupPtr, groupSize);
    bool gok = UpdateResourceW(hUpdate, RT_GROUP_ICON, (IntPtr)1, 0x0409, groupPtr, (uint)groupSize);
    Marshal.FreeHGlobal(groupPtr);

    if (!gok)
    {
        Console.Error.WriteLine($"UpdateResource RT_GROUP_ICON failed: {Marshal.GetLastWin32Error()}");
        return 1;
    }
    Console.WriteLine($"  RT_GROUP_ICON: {groupSize} bytes");
}
finally
{
    bool discarded = !EndUpdateResourceW(hUpdate, fDiscard: false);
    if (discarded)
        Console.Error.WriteLine($"EndUpdateResource failed: {Marshal.GetLastWin32Error()}");
}

Console.WriteLine($"Stamped icon into {exePath}");
return 0;

[DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
static extern IntPtr BeginUpdateResourceW(string pFileName, [MarshalAs(UnmanagedType.Bool)] bool bDeleteExistingResources);

[DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
static extern bool UpdateResourceW(IntPtr hUpdate, uint lpType, IntPtr lpName, ushort wLanguage, IntPtr lpData, uint cb);

[DllImport("kernel32.dll", SetLastError = true)]
static extern bool EndUpdateResourceW(IntPtr hUpdate, [MarshalAs(UnmanagedType.Bool)] bool fDiscard);
