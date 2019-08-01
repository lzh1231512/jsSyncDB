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
        private readonly IHostingEnvironment _hostingEnvironment;

        public SaveCodeController(IHostingEnvironment hostingEnvironment)
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


        public IActionResult Get(string code)
        {
            Response.ContentType = "text/plain;charset=utf-8";
            Response.Headers.Add("Access-Control-Allow-Origin", "*");
            Response.Headers.Add("Access-Control-Allow-Methods", "POST");
            Response.Headers.Add("Access-Control-Allow-Headers", "x-requested-with,content-type");

            string path = getPath(code);
            string data = "";
            bool result = true;
            if (System.IO.File.Exists(path))
            {
                try
                {
                    using (FileStream fs = new FileStream(path, FileMode.Open, FileAccess.Read))
                    {
                        using (StreamReader sr = new StreamReader(fs))
                        {
                            data = sr.ReadToEnd();
                            sr.Close();
                            fs.Close();
                        }
                    }
                }
                catch (Exception e)
                {
                    result = false;
                }
            }
            return Json(new
            {
                result,
                data
            });
        }

        public IActionResult Set(string code,string data)
        {
            Response.ContentType = "text/plain;charset=utf-8";
            Response.Headers.Add("Access-Control-Allow-Origin", "*");
            Response.Headers.Add("Access-Control-Allow-Methods", "POST");
            Response.Headers.Add("Access-Control-Allow-Headers", "x-requested-with,content-type");

            string path = getPath(code);
            bool result = true;
            try
            {
                using (FileStream fs = new FileStream(path, FileMode.Create, FileAccess.ReadWrite))
                {
                    using (StreamWriter sr = new StreamWriter(fs))
                    {
                        sr.Write(data);
                        sr.Close();
                        fs.Close();
                    }
                }
            }
            catch (Exception e)
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