using System;
using System.Collections.Generic;
using System.Linq;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using web_netcore.Commons;

namespace web_netcore.Controllers
{
    public class SaveCodeController : Controller
    {
        private readonly IWebHostEnvironment _hostingEnvironment;

        public SaveCodeController(IWebHostEnvironment hostingEnvironment)
        {
            _hostingEnvironment = hostingEnvironment;
        }

        private string getPath(string code)
        {
            var filePath = Configs.uploadFilePath;
            filePath = _hostingEnvironment.WebRootPath.TrimEnd('\\', '/')
                + "/" + filePath.TrimEnd('\\', '/') + "/";
            System.IO.Directory.CreateDirectory(filePath);

            String ml = filePath + "/" + code + "/";
            System.IO.Directory.CreateDirectory(ml);

            return  filePath + "/" + code + "/code";
        }


        public IActionResult Get(string code,string pwd, string newpwd)
        {
            string path = getPath(code);
            string data = "";
            string thepwd = "";
            int wrongTime = 0;
            int result = 0;
            if (System.IO.File.Exists(path))
            {
                try
                {
                    using (FileStream fs = new FileStream(path, FileMode.Open, FileAccess.Read))
                    {
                        using (StreamReader sr = new StreamReader(fs))
                        {
                            data = sr.ReadLine();
                            thepwd = sr.ReadLine();
                            wrongTime = int.Parse(sr.ReadLine());
                            sr.Close();
                            fs.Close();
                        }
                    }
                    if(thepwd!= pwd)
                    {
                        wrongTime++;
                        if (wrongTime >= 5)
                        {
                            System.IO.File.Delete(path);
                            result = -3;
                        }
                        else
                        {
                            using (FileStream fs = new FileStream(path, FileMode.Create, FileAccess.ReadWrite))
                            {
                                using (StreamWriter sr = new StreamWriter(fs))
                                {
                                    sr.WriteLine(data);
                                    sr.WriteLine(thepwd);
                                    sr.WriteLine(wrongTime);
                                    sr.Close();
                                    fs.Close();
                                }
                            }
                            result = -2;
                        }
                        data = "";
                    }
                    else
                    {
                        using (FileStream fs = new FileStream(path, FileMode.Create, FileAccess.ReadWrite))
                        {
                            using (StreamWriter sr = new StreamWriter(fs))
                            {
                                sr.WriteLine(data);
                                if (string.IsNullOrEmpty(newpwd))
                                    newpwd = thepwd;
                                sr.WriteLine(newpwd);
                                sr.WriteLine(0);
                                sr.Close();
                                fs.Close();
                            }
                        }
                        result = 1;
                    }
                }
                catch
                {
                    data = "";
                    result = -1;
                }
            }
            return Json(new
            {
                result,
                data
            });
        }

        public IActionResult Set(string code,string data, string pwd)
        {
            string path = getPath(code);
            bool result = true;
            try
            {
                using (FileStream fs = new FileStream(path, FileMode.Create, FileAccess.ReadWrite))
                {
                    using (StreamWriter sr = new StreamWriter(fs))
                    {
                        sr.WriteLine(data);
                        sr.WriteLine(pwd);
                        sr.WriteLine("0");
                        sr.Close();
                        fs.Close();
                    }
                }
            }
            catch
            {
                result = false;
            }
            return Json(new
            {
                result
            });
        }
    }
}