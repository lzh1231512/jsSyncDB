using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace web_netcore.Commons
{
    public class Exec
    {
        public static bool DeleteFiles(string path)
        {
            try
            {
                foreach (var dic in (new DirectoryInfo(path)).GetDirectories())
                {
                    if (!DeleteFiles(dic.FullName))
                    {
                        return false;
                    }
                }
                foreach (FileInfo file in (new DirectoryInfo(path)).GetFiles())
                {
                    file.Attributes = FileAttributes.Normal;
                    file.Delete();
                }
                foreach (var dic in (new DirectoryInfo(path)).GetDirectories())
                {
                    dic.Attributes = FileAttributes.Normal;
                    dic.Delete();
                }
                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}
