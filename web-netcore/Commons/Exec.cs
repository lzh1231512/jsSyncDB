using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;

namespace web_netcore.Commons
{
    public class Exec
    {
        public static bool ExecCmd(string cmd, string arg)
        {
            try
            {
                var psi = new ProcessStartInfo(cmd, arg) { RedirectStandardOutput = true };
                var proc = Process.Start(psi);
                if (proc == null)
                {
                    Console.WriteLine("Can not exec.");
                    return false;
                }
                else
                {

                    using (var sr = proc.StandardOutput)
                    {
                        while (!sr.EndOfStream)
                        {
                            Console.WriteLine(sr.ReadLine());
                        }
                        if (!proc.HasExited)
                        {
                            proc.Kill();
                        }
                    }
                    return true;

                }
            }
            catch
            {
                return false;
            }
        }
    }
}
