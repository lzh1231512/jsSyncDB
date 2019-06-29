using Myrmec;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading;
using System.Threading.Tasks;

namespace web_netcore.Commons
{
    public class ImageDownloader
    {
        class img
        {
            public string url { set; get; }
            public string savepath { set; get; }
            public string bkFilePath { set; get; }
            public int status { set; get; }
        }

        static Dictionary<string, img>
            tasks = new Dictionary<string, img>();

        static int theadCount = 5;

        public static void addTask(string url, string savepath,string bkFilePath)
        {
            lock (tasks)
            {
                if (!tasks.ContainsKey(url))
                {
                    tasks.Add(url, new img()
                    {
                        url = url,
                        savepath = savepath,
                        status = 0,
                        bkFilePath= bkFilePath
                    });
                }
            }
            startDownload();
        }

        private static void startDownload()
        {
            lock (tasks)
            {
                if (tasks.Count(f => f.Value.status == 1) < theadCount 
                    && tasks.Any(f => f.Value.status == 0))
                {
                    var data = tasks.First(f => f.Value.status == 0);
                    data.Value.status = 1;
                    ThreadPool.QueueUserWorkItem(new WaitCallback(download), data);
                }
                else if (tasks.Count > 0 && tasks.Count(f => f.Value.status == 1 || f.Value.status == 0) == 0)
                {
                    tasks.Clear();
                    Console.WriteLine("download finish");
                }
            }
        }

        private static void download(object a)
        {
            try
            {
                var data = (KeyValuePair<string, img>)a;
                var url = data.Key;
                var savepath = data.Value.savepath;
                Console.WriteLine("start download:" + url);

                var tmpPath = savepath + ".tmp";
                if (System.IO.File.Exists(tmpPath))
                {
                    System.IO.File.Delete(tmpPath);
                }
                if (ImageDownload(url, tmpPath))
                {
                    File.Copy(tmpPath, savepath);
                    data.Value.status = 2;
                }
                else
                {
                    File.Copy(data.Value.bkFilePath, savepath, true);
                    data.Value.status = -1;
                }

                if (System.IO.File.Exists(tmpPath))
                {
                    try
                    {
                        System.IO.File.Delete(tmpPath);
                    }
                    catch { }
                }
                startDownload();
            }
            catch
            {
                
            }
        }

        private static bool ImageDownload(string url, string filePath)
        {
            try
            {
                if (System.IO.File.Exists(filePath))
                {
                    System.IO.File.Delete(filePath);
                }
                using (FileStream fs = new FileStream(filePath, FileMode.Append, FileAccess.Write, FileShare.ReadWrite))
                {
                    HttpWebRequest request = WebRequest.Create(url) as HttpWebRequest;
                    HttpWebResponse response = request.GetResponse() as HttpWebResponse;
                    Stream responseStream = response.GetResponseStream();
                    byte[] bArr = new byte[1024];
                    int iTotalSize = 0;
                    int size = responseStream.Read(bArr, 0, (int)bArr.Length);
                    while (size > 0)
                    {
                        iTotalSize += size;
                        fs.Write(bArr, 0, size);
                        size = responseStream.Read(bArr, 0, (int)bArr.Length);
                    }
                    fs.Flush();
                    fs.Close();
                    responseStream.Close();
                    responseStream.Dispose();
                }

                return IsImage(filePath);
            }
            catch
            {
                return false;
            }
        }

        private static Boolean IsImage(string path)
        {
            try
            {
                Sniffer sniffer = new Sniffer();
                sniffer.Populate(FileTypes.Common);
                byte[] fileHead = new byte[20];
                using (System.IO.FileStream fs = new FileStream(path, FileMode.Open))
                {
                    if (fs.Length == 0)
                        return false;
                    fs.Read(fileHead, 0, 20);
                    fs.Close();
                }

                // start match.
                List<string> results = sniffer.Match(fileHead);

                return results.Contains("ico") ||
                    results.Contains("jpg") ||
                    results.Contains("png") ||
                    results.Contains("gif");
            }
            catch (Exception e)
            {
                return false;
            }
        }
    }
}
