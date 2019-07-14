using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;

namespace web_netcore.Commons
{
    public class Exec
    {
        public static string ExecCmd(string cmd, string arg)
        {
            try
            {
                var psi = new ProcessStartInfo(cmd, arg) { RedirectStandardOutput = true };
                var proc = Process.Start(psi);
                if (proc == null)
                {
                    return "Can not exec.";
                }
                else
                {
                    var res = "";
                    using (var sr = proc.StandardOutput)
                    {
                        while (!sr.EndOfStream)
                        {
                            res+=(sr.ReadLine());
                        }
                        if (!proc.HasExited)
                        {
                            proc.Kill();
                        }
                    }
                    return res;

                }
            }
            catch (Exception ex)
            {
                return "error:"+ex.Message+"\r\n"+ex.StackTrace;
            }
        }
    }
}
