'use strict';

const SOURCE_REF = {
    sourceType: 'ORIGINAL_PRACTICE',
    organization: 'Hành Trình Mới',
    documentName: 'Hành Trình Mới · Survey & Placement V21',
    version: '21.0.0',
    verification: 'unverified',
    notes: 'Bộ khảo sát và diagnostic nguyên bản để cá nhân hóa; kết quả placement chỉ là ước lượng năng lực học tập.'
};

const question = (code, prompt, type = 'single_choice', options = [], extra = {}) => ({ code, prompt, type, options, required: Boolean(extra.required), section: extra.section || 'Hồ sơ học tập', ...(extra.conditions ? { conditions: extra.conditions } : {}), ...(extra.placeholder ? { placeholder: extra.placeholder } : {}), ...(extra.helpText ? { helpText: extra.helpText } : {}) });

function surveyQuestions() {
    return [
        question('educationLevel', 'Bạn đang học ở cấp độ nào?', 'single_choice', [
            { label: 'Tiểu học (lớp 1–5)', value: 'PRIMARY' },
            { label: 'THCS (lớp 6–9)', value: 'SECONDARY_LOWER' },
            { label: 'THPT (lớp 10–12)', value: 'SECONDARY_UPPER' },
            { label: 'Cao đẳng / Đại học', value: 'HIGHER_EDUCATION' },
            { label: 'Học chứng chỉ / ngoại ngữ / MOS', value: 'ENGLISH_CERTIFICATION' },
            { label: 'Đã tốt nghiệp / đi làm / tự học', value: 'SELF_STUDY' }
        ], { required: true, section: '1. Trình độ hiện tại' }),
        question('educationStatus', 'Trạng thái học tập hiện tại của bạn?', 'single_choice', ['Đang học phổ thông', 'Sinh viên cao đẳng/đại học', 'Đã tốt nghiệp', 'Người đi làm', 'Tự học / học bổ sung'].map(value => ({ label: value, value })), { required: true, section: '1. Trình độ hiện tại' }),
        question('currentGrade', 'Bạn đang học lớp mấy? (chỉ chọn nếu học phổ thông)', 'numerical', [], { section: '1. Trình độ hiện tại', conditions: { field: 'educationLevel', in: ['PRIMARY', 'SECONDARY_LOWER', 'SECONDARY_UPPER'] }, placeholder: 'Nhập số từ 1 đến 12' }),
        question('institution', 'Tên trường / cơ sở đào tạo (nếu có)', 'short_answer', [], { section: '1. Trình độ hiện tại', placeholder: 'Ví dụ: Trường THPT…, Trường Đại học…' }),
        question('university', 'Trường cao đẳng / đại học', 'short_answer', [], { section: '2. Hồ sơ đại học', conditions: { field: 'educationLevel', in: ['HIGHER_EDUCATION'] }, placeholder: 'Tên trường' }),
        question('faculty', 'Khoa', 'short_answer', [], { section: '2. Hồ sơ đại học', conditions: { field: 'educationLevel', in: ['HIGHER_EDUCATION'] }, placeholder: 'Ví dụ: Khoa Công nghệ thông tin' }),
        question('field', 'Lĩnh vực đào tạo', 'short_answer', [], { section: '2. Hồ sơ đại học', conditions: { field: 'educationLevel', in: ['HIGHER_EDUCATION'] }, placeholder: 'Ví dụ: Công nghệ, Kinh tế, Kỹ thuật' }),
        question('disciplineGroup', 'Nhóm ngành', 'short_answer', [], { section: '2. Hồ sơ đại học', conditions: { field: 'educationLevel', in: ['HIGHER_EDUCATION'] } }),
        question('major', 'Ngành học', 'short_answer', [], { section: '2. Hồ sơ đại học', conditions: { field: 'educationLevel', in: ['HIGHER_EDUCATION'] }, placeholder: 'Ví dụ: Khoa học máy tính, Kinh tế, Cơ điện tử' }),
        question('specialization', 'Chuyên ngành / định hướng', 'short_answer', [], { section: '2. Hồ sơ đại học', conditions: { field: 'educationLevel', in: ['HIGHER_EDUCATION'] } }),
        question('trainingProgram', 'Chương trình đào tạo', 'short_answer', [], { section: '2. Hồ sơ đại học', conditions: { field: 'educationLevel', in: ['HIGHER_EDUCATION'] } }),
        question('cohort', 'Khóa tuyển sinh', 'short_answer', [], { section: '2. Hồ sơ đại học', conditions: { field: 'educationLevel', in: ['HIGHER_EDUCATION'] }, placeholder: 'Ví dụ: K2025' }),
        question('academicYear', 'Năm học hiện tại', 'short_answer', [], { section: '2. Hồ sơ đại học', conditions: { field: 'educationLevel', in: ['HIGHER_EDUCATION'] }, placeholder: 'Ví dụ: Năm 2' }),
        question('semester', 'Học kỳ', 'short_answer', [], { section: '2. Hồ sơ đại học', conditions: { field: 'educationLevel', in: ['HIGHER_EDUCATION'] }, placeholder: 'Ví dụ: Học kỳ 1' }),
        question('goals', 'Bạn muốn đạt được điều gì? (có thể chọn nhiều)', 'multiple_choice', [
            'Nắm chắc kiến thức ở trường', 'Cải thiện môn/kỹ năng còn yếu', 'Chuẩn bị thi giữa kỳ/cuối kỳ', 'Ôn thi chuyển cấp / tốt nghiệp',
            'TOEIC', 'IELTS', 'MOS', 'Học lập trình / CNTT', 'Học kiến thức chuyên ngành đại học', 'Chuẩn bị thực tập / việc làm', 'Định hướng nghề nghiệp'
        ].map(value => ({ label: value, value })), { required: true, section: '3. Mục tiêu' }),
        question('targetExam', 'Bạn đang hướng đến bài thi/chứng chỉ nào?', 'multiple_choice', ['Không có mục tiêu thi cụ thể', 'TOEIC', 'IELTS Academic', 'IELTS General Training', 'MOS Word', 'MOS Excel', 'MOS PowerPoint', 'Thi học kỳ / tốt nghiệp', 'Bài kiểm tra chuyên ngành'].map(value => ({ label: value, value })), { section: '3. Mục tiêu' }),
        question('targetScore', 'Điểm / band / kết quả mong muốn', 'short_answer', [], { section: '3. Mục tiêu', placeholder: 'Ví dụ: TOEIC 750, IELTS 6.5, qua môn ≥ 8' }),
        question('targetDate', 'Thời hạn mục tiêu (nếu có)', 'short_answer', [], { section: '3. Mục tiêu', placeholder: 'Ví dụ: 30/06/2027' }),
        question('favoriteSubjects', 'Môn học / lĩnh vực bạn thích', 'multiple_choice', ['Toán', 'Ngữ văn', 'Tiếng Việt', 'Tiếng Anh', 'Khoa học tự nhiên', 'Vật lý', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lý', 'Tin học / Lập trình', 'Kinh tế / Kinh doanh', 'Cơ điện tử / Điện tử', 'Thiết kế / Mỹ thuật'].map(value => ({ label: value, value })), { section: '4. Kỹ năng và sở thích' }),
        question('strengths', 'Bạn tự tin ở những môn/kỹ năng nào?', 'multiple_choice', ['Tư duy logic', 'Giải quyết vấn đề', 'Đọc hiểu', 'Viết', 'Nghe', 'Nói', 'Toán', 'Lập trình', 'Phân tích dữ liệu', 'Thực hành kỹ thuật', 'Thuyết trình', 'Làm việc nhóm'].map(value => ({ label: value, value })), { section: '4. Kỹ năng và sở thích' }),
        question('weaknesses', 'Bạn muốn cải thiện điều gì nhất?', 'multiple_choice', ['Mất gốc kiến thức', 'Làm bài chậm', 'Dễ nhầm công thức/quy tắc', 'Đọc hiểu', 'Nghe tiếng Anh', 'Nói tiếng Anh', 'Viết tiếng Anh', 'Ngữ pháp / từ vựng', 'Tư duy thuật toán', 'Debug code', 'Thực hành phần mềm', 'Kiến thức chuyên ngành', 'Quản lý thời gian'].map(value => ({ label: value, value })), { section: '4. Kỹ năng và sở thích' }),
        question('careerInterests', 'Ngành nghề bạn quan tâm', 'multiple_choice', ['Chưa xác định', 'Phát triển phần mềm', 'AI / Khoa học dữ liệu', 'An toàn thông tin', 'Kinh doanh / Quản trị', 'Marketing', 'Tài chính / Kế toán', 'Cơ điện tử / Tự động hóa', 'Điện – điện tử', 'Cơ khí', 'Thiết kế UI/UX', 'Giáo dục', 'Ngôn ngữ / Biên phiên dịch'].map(value => ({ label: value, value })), { section: '4. Kỹ năng và sở thích' }),
        question('studyTime', 'Mỗi ngày bạn có thể học bao lâu?', 'single_choice', ['15 phút', '30 phút', '45 phút', '60 phút', '90 phút', 'Trên 2 giờ'].map(value => ({ label: value, value })), { required: true, section: '5. Thói quen học' }),
        question('studyDaysPerWeek', 'Bạn có thể học bao nhiêu ngày mỗi tuần?', 'numerical', [], { section: '5. Thói quen học', placeholder: 'Nhập số từ 1 đến 7' }),
        question('preferredTimeOfDay', 'Bạn thường học tốt nhất vào lúc nào?', 'single_choice', ['Buổi sáng', 'Buổi chiều', 'Buổi tối', 'Khuya', 'Thay đổi theo lịch'].map(value => ({ label: value, value })), { section: '5. Thói quen học' }),
        question('learningFormats', 'Cách học nào giúp bạn hiểu nhất? (chọn nhiều)', 'multiple_choice', ['Đọc lý thuyết chi tiết', 'Xem giáo viên giảng từng bước', 'Ví dụ có lời giải', 'Làm nhiều bài tập', 'Thực hành trên máy tính / phần mềm', 'Nghe audio', 'Flashcard', 'Dự án thực tế', 'Đề thi có giới hạn thời gian', 'Giải thích bằng hình ảnh'].map(value => ({ label: value, value })), { required: true, section: '5. Thói quen học' }),
        question('confidence', 'Bạn tự đánh giá mức tự tin với mục tiêu hiện tại?', 'single_choice', ['Rất thấp', 'Thấp', 'Trung bình', 'Khá tự tin', 'Rất tự tin'].map(value => ({ label: value, value })), { section: '5. Thói quen học' }),
        question('focus', 'Điều gì đang cản trở bạn học tốt hơn?', 'essay', [], { section: '6. Ghi chú cá nhân', placeholder: 'Mô tả môn khó, lịch học, mục tiêu nghề nghiệp hoặc điều bạn mong AI hỗ trợ.' })
    ];
}

function gradeQuestions(grade) {
    const band = grade <= 3 ? 'BASIC' : grade <= 5 ? 'PRIMARY' : grade <= 7 ? 'FOUNDATION' : grade <= 9 ? 'SECONDARY' : 'HIGH_SCHOOL';
    const arithmetic = band === 'BASIC' ? [
        ['Tính 7 + 5 = ?', ['10', '11', '12', '13'], '12'],
        ['Tính 14 - 6 = ?', ['6', '7', '8', '9'], '8'],
        ['Số nào lớn nhất?', ['18', '28', '12', '21'], '28']
    ] : band === 'PRIMARY' ? [
        ['Tính 3/4 + 1/4 = ?', ['1/2', '1', '4/8', '3/8'], '1'],
        ['25 × 4 = ?', ['75', '90', '100', '125'], '100'],
        ['Chu vi hình vuông cạnh 6 cm?', ['12 cm', '18 cm', '24 cm', '36 cm'], '24 cm']
    ] : band === 'FOUNDATION' ? [
        ['Tính -8 + 13 = ?', ['-21', '-5', '5', '21'], '5'],
        ['Giá trị của 3² + 4 là?', ['10', '12', '13', '15'], '13'],
        ['Phân số bằng 0,5 là?', ['1/3', '1/2', '2/3', '3/4'], '1/2']
    ] : band === 'SECONDARY' ? [
        ['Giải phương trình 2x + 3 = 11.', ['x = 2', 'x = 3', 'x = 4', 'x = 7'], 'x = 4'],
        ['Khai triển (a + b)² là?', ['a²+b²', 'a²+2ab+b²', 'a²-ab+b²', '2a+2b'], 'a²+2ab+b²'],
        ['Nếu y = 2x - 1 và x = 3 thì y = ?', ['4', '5', '6', '7'], '5']
    ] : [
        ['Nghiệm của x² - 5x + 6 = 0 là?', ['1 và 6', '2 và 3', '-2 và -3', '0 và 5'], '2 và 3'],
        ['Đạo hàm của f(x) = x³ là?', ['x²', '2x', '3x²', '3x³'], '3x²'],
        ['Nếu log₂(x) = 3 thì x = ?', ['6', '8', '9', '12'], '8']
    ];
    const build = (prefix, items, skill) => ({ code: `${prefix}-${grade}`, title: skill, skill, questions: items.map((item, index) => ({ id: `${prefix}-${grade}-Q${index + 1}`, code: `${prefix}-${grade}-Q${index + 1}`, prompt: item[0], type: 'single_choice', options: item[1].map(value => ({ label: value, value })), answer: item[2], difficulty: index === 0 ? 'EASY' : index === 1 ? 'MEDIUM' : 'MEDIUM', points: 1 })) });
    const reading = [
        ['Đọc câu “Lan chăm sóc cây mỗi chiều.” Ai là người chăm sóc cây?', ['Lan', 'Cây', 'Chiều', 'Không rõ'], 'Lan'],
        ['Từ “chăm sóc” gần nghĩa nhất với từ nào?', ['Bỏ mặc', 'Quan tâm', 'Phá hỏng', 'Tránh xa'], 'Quan tâm'],
        ['Câu trên cho biết hoạt động diễn ra khi nào?', ['Mỗi sáng', 'Mỗi trưa', 'Mỗi chiều', 'Mỗi tối'], 'Mỗi chiều']
    ];
    const science = [
        ['Nguồn năng lượng chính của Trái Đất là gì?', ['Mặt Trời', 'Mặt Trăng', 'Gió', 'Than đá'], 'Mặt Trời'],
        ['Nước đá chuyển thành nước lỏng khi nào?', ['Đông đặc', 'Nóng chảy', 'Ngưng tụ', 'Bay hơi'], 'Nóng chảy'],
        ['Thực vật cần yếu tố nào để quang hợp?', ['Ánh sáng', 'Bóng tối hoàn toàn', 'Nhựa', 'Kim loại'], 'Ánh sáng']
    ];
    return [build('MATH', arithmetic, `Toán học nền tảng lớp ${grade}`), build('READ', reading, `Đọc hiểu lớp ${grade}`), build('SCI', science, `Khoa học và suy luận lớp ${grade}`)];
}

function placementDefinitions() {
    const definitions = [];
    for (let grade = 1; grade <= 12; grade += 1) definitions.push({ code: `HTM-PLACEMENT-K12-G${grade}-V21`, title: `Placement lớp ${grade} · Toán, đọc hiểu và khoa học`, target: `K12_GRADE_${grade}`, version: '21.0.0', skillSections: gradeQuestions(grade), status: 'PUBLISHED', sourceRef: SOURCE_REF });
    definitions.push({
        code: 'HTM-PLACEMENT-UNIVERSITY-IT-V21', title: 'Placement Đại học · CNTT và lập trình nền tảng', target: 'UNIVERSITY_IT', version: '21.0.0', status: 'PUBLISHED', sourceRef: SOURCE_REF,
        skillSections: [
            { code: 'PROGRAMMING', skill: 'Lập trình nền tảng', title: 'Lập trình nền tảng', questions: [
                { id: 'it-q1', prompt: 'Trong lập trình, vòng lặp thường được dùng để làm gì?', type: 'single_choice', options: ['Lặp lại một nhóm lệnh', 'Đổi tên file', 'Tạo tài khoản', 'Xóa hệ điều hành'].map(value => ({ label: value, value })), answer: 'Lặp lại một nhóm lệnh' },
                { id: 'it-q2', prompt: 'Độ phức tạp thời gian của tìm kiếm tuyến tính trong mảng chưa sắp xếp ở trường hợp xấu nhất là?', type: 'single_choice', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'].map(value => ({ label: value, value })), answer: 'O(n)' },
                { id: 'it-q3', prompt: 'Hàm giúp ích gì trong chương trình?', type: 'short_answer', options: [], answer: 'tái sử dụng' }
            ] },
            { code: 'DEBUGGING', skill: 'Debug và kiểm thử', title: 'Debug và kiểm thử', questions: [
                { id: 'it-q4', prompt: 'Khi chương trình biên dịch được nhưng cho kết quả sai, bước hợp lý tiếp theo là gì?', type: 'single_choice', options: ['Debug với input nhỏ và kiểm tra giả định', 'Xóa toàn bộ source', 'Bỏ qua test', 'Đổi tên biến ngẫu nhiên'].map(value => ({ label: value, value })), answer: 'Debug với input nhỏ và kiểm tra giả định' },
                { id: 'it-q5', prompt: 'Unit test chủ yếu kiểm thử điều gì?', type: 'single_choice', options: ['Một đơn vị/chức năng nhỏ', 'Toàn bộ doanh nghiệp', 'Tốc độ internet', 'Thiết kế bàn phím'].map(value => ({ label: value, value })), answer: 'Một đơn vị/chức năng nhỏ' },
                { id: 'it-q6', prompt: 'Nêu một trường hợp biên cần thử khi viết hàm xử lý mảng.', type: 'short_answer', options: [], answer: 'mảng rỗng' }
            ] },
            { code: 'LOGIC', skill: 'Tư duy thuật toán', title: 'Tư duy thuật toán', questions: [
                { id: 'it-q7', prompt: 'Cấu trúc dữ liệu nào phù hợp để lấy phần tử vào sau ra trước?', type: 'single_choice', options: ['Queue', 'Stack', 'Tree', 'Graph'].map(value => ({ label: value, value })), answer: 'Stack' },
                { id: 'it-q8', prompt: 'Điều kiện dừng trong đệ quy có vai trò gì?', type: 'single_choice', options: ['Ngăn lời gọi đệ quy tiếp tục vô hạn', 'Tăng số biến toàn cục', 'Tự động biên dịch', 'Tạo giao diện'].map(value => ({ label: value, value })), answer: 'Ngăn lời gọi đệ quy tiếp tục vô hạn' },
                { id: 'it-q9', prompt: 'Hãy mô tả ngắn gọn cách kiểm tra một chuỗi có phải palindrome không.', type: 'essay', options: [], answer: '', rubric: { criteria: ['xử lý hai đầu chuỗi', 'dừng giữa chuỗi', 'xử lý chữ hoa/khoảng trắng'] } }
            ] }
        ]
    });
    const addChoiceTest = (code, title, target, sections) => definitions.push({ code, title, target, version: '21.0.0', status: 'PUBLISHED', sourceRef: SOURCE_REF, skillSections: sections });
    const simpleSection = (code, skill, items) => ({ code, skill, title: skill, questions: items.map((item, index) => ({ id: `${code}-q${index + 1}`, prompt: item[0], type: item[3] || 'single_choice', options: (item[1] || []).map(value => ({ label: value, value })), answer: item[2], points: 1 })) });
    addChoiceTest('HTM-PLACEMENT-TOEIC-V21', 'Placement TOEIC · Part 1–7, Listening, Grammar và Vocabulary', 'TOEIC', [
        simpleSection('TOEIC-PART1', 'Part 1 · Photographs', [
            ['For a photograph question, what should you identify first?', ['The main people, objects and actions', 'A word that sounds similar', 'Every background detail', 'The longest answer'], 'The main people, objects and actions'],
            ['A person is reaching for a folder. Which sentence best describes the action?', ['The person is reaching for a folder', 'The person has mailed the folder', 'The folder is being repaired', 'The person is leaving the building'], 'The person is reaching for a folder']
        ]),
        simpleSection('TOEIC-PART2', 'Part 2 · Question–Response', [
            ['“When will the shipment arrive?” Which response is most appropriate?', ['It is scheduled for Friday', 'At the loading dock', 'The blue shipment', 'I shipped it yesterday'], 'It is scheduled for Friday'],
            ['“Would you mind closing the window?” Which response is most appropriate?', ['Certainly, I will close it', 'The window is on the left', 'It was purchased yesterday', 'At three o’clock'], 'Certainly, I will close it']
        ]),
        simpleSection('TOEIC-PART3', 'Part 3 · Conversations', [
            ['Two coworkers discuss a delayed meeting. What should you listen for first?', ['The reason for the delay and the new time', 'The color of their clothes', 'Every filler word', 'Unrelated background sounds'], 'The reason for the delay and the new time'],
            ['A customer says the order is incomplete. What is the most likely next step?', ['Check the order and arrange the missing items', 'Close the store immediately', 'Cancel every customer order', 'Ignore the complaint'], 'Check the order and arrange the missing items']
        ]),
        simpleSection('TOEIC-PART4', 'Part 4 · Talks and announcements', [
            ['In a public announcement, which information is most useful to note?', ['Purpose, location, time and action required', 'Only the speaker’s accent', 'Every word in exact spelling', 'Unrelated personal details'], 'Purpose, location, time and action required'],
            ['An announcement says boarding has moved to Gate 12. What should passengers do?', ['Go to Gate 12', 'Leave the airport', 'Collect checked baggage immediately', 'Wait at the original gate without checking'], 'Go to Gate 12']
        ]),
        simpleSection('TOEIC-PART5', 'Part 5 · Incomplete Sentences', [
            ['The report ___ by the manager yesterday.', ['reviews', 'was reviewed', 'reviewing', 'has review'], 'was reviewed'],
            ['Please submit the form ___ Friday.', ['by', 'between', 'during', 'among'], 'by']
        ]),
        simpleSection('TOEIC-PART6', 'Part 6 · Text Completion', [
            ['“The office will be closed on Monday. ___, online support will remain available.” Choose the best connector.', ['However', 'Unless', 'Despite', 'Because of'], 'However'],
            ['“Please find the invoice ___ to this email.” Choose the best word.', ['attached', 'attaching', 'attachment', 'attaches'], 'attached']
        ]),
        simpleSection('TOEIC-PART7', 'Part 7 · Reading Comprehension', [
            ['A notice says “Please retain this receipt for your records.” What should customers do?', ['Keep the receipt', 'Return the receipt immediately', 'Sign the receipt twice', 'Pay a late fee'], 'Keep the receipt'],
            ['An email says a deadline has been extended until June 30. What does this mean?', ['The new deadline is June 30', 'The deadline was canceled', 'The task must be done yesterday', 'The sender has left the company'], 'The new deadline is June 30']
        ]),
        simpleSection('TOEIC-LISTENING', 'Listening comprehension', [
            ['When a recording is played once, what is a useful first strategy?', ['Preview questions and listen for key information', 'Translate every word before choosing', 'Ignore who is speaking', 'Wait until the recording ends before reading'], 'Preview questions and listen for key information'],
            ['The speaker says “The meeting has been postponed.” What happened?', ['The meeting was moved to a later time', 'The meeting started early', 'The meeting was canceled forever', 'The room was cleaned'], 'The meeting was moved to a later time']
        ]),
        simpleSection('TOEIC-GRAMMAR', 'Grammar', [
            ['Each of the applicants ___ a confirmation email.', ['receive', 'receives', 'receiving', 'have received'], 'receives'],
            ['The equipment must ___ before the presentation.', ['inspect', 'be inspected', 'inspected', 'inspecting'], 'be inspected']
        ]),
        simpleSection('TOEIC-VOCABULARY', 'Vocabulary', [
            ['Choose the closest meaning of “inquire”.', ['Ask for information', 'Cancel', 'Purchase', 'Deliver'], 'Ask for information'],
            ['A “comprehensive” report is best described as:', ['Complete and covering the important details', 'Very short and incomplete', 'Difficult to read because it is handwritten', 'Only about one minor detail'], 'Complete and covering the important details']
        ])
    ]);
    addChoiceTest('HTM-PLACEMENT-IELTS-V21', 'Placement IELTS · Listening, Reading, Writing và Speaking', 'IELTS', [
        simpleSection('IELTS-LISTENING', 'Listening', [
            ['Before an IELTS listening recording starts, what should you do?', ['Read the questions and predict the information required', 'Write an essay immediately', 'Ignore word limits', 'Choose answers before hearing any evidence'], 'Read the questions and predict the information required'],
            ['A speaker corrects a time from 8:15 to 8:50. Which time should you record?', ['8:15', '8:50', 'Both times without context', 'Neither time'], '8:50']
        ]),
        simpleSection('IELTS-READING', 'Reading', [
            ['A passage states that a policy was introduced gradually. “Gradually” means:', ['All at once', 'Step by step', 'Without planning', 'Very rarely'], 'Step by step'],
            ['Which evidence best supports an academic claim?', ['A relevant, credible source', 'An anonymous rumor', 'A guess', 'An unrelated image'], 'A relevant, credible source']
        ]),
        simpleSection('IELTS-WRITING', 'Writing', [
            ['What is the main purpose of a topic sentence?', ['State the paragraph’s main idea', 'List every reference', 'Repeat the conclusion only', 'Replace all evidence'], 'State the paragraph’s main idea'],
            ['Write a short overview comparing the main trends in a chart.', [], '', 'essay']
        ]),
        simpleSection('IELTS-SPEAKING', 'Speaking', [
            ['In Speaking Part 2, what is a useful way to organize a long turn?', ['Cover the cue-card points with a clear beginning, details and ending', 'Answer only with yes or no', 'Memorize unrelated phrases', 'Avoid giving examples'], 'Cover the cue-card points with a clear beginning, details and ending'],
            ['Speak for 30–45 seconds about a place you enjoy visiting and explain why.', [], '', 'speaking']
        ])
    ]);
    addChoiceTest('HTM-PLACEMENT-MOS-V21', 'Placement MOS · Word, Excel và PowerPoint', 'MOS', [
        simpleSection('MOS-WORD', 'Word practical knowledge', [
            ['Which feature keeps heading formatting consistent across a document?', ['Styles', 'Manual spaces', 'Repeated blank lines', 'Text highlight only'], 'Styles'],
            ['For a long report, which tool creates an automatic table of contents?', ['Heading styles + Table of Contents', 'Find and Replace only', 'Word Count', 'Page Color'], 'Heading styles + Table of Contents']
        ]),
        simpleSection('MOS-EXCEL', 'Excel practical knowledge', [
            ['Which formula adds values in cells A1 through A10?', ['=SUM(A1:A10)', '=ADD(A1-A10)', '=TOTAL(A1;A10)', '=COUNT(A1:A10)'], '=SUM(A1:A10)'],
            ['Which feature summarizes values by category interactively?', ['PivotTable', 'Font dialog', 'Page border', 'Slide Master'], 'PivotTable']
        ]),
        simpleSection('MOS-POWERPOINT', 'PowerPoint practical knowledge', [
            ['Which feature applies a consistent layout to many slides?', ['Slide Master', 'Spell Check', 'Word Count', 'Mail Merge'], 'Slide Master'],
            ['When presenting charts, which practice is best?', ['Use clear labels and readable contrast', 'Use as many effects as possible', 'Hide axis labels', 'Use tiny text'], 'Use clear labels and readable contrast']
        ])
    ]);
    addChoiceTest('HTM-PLACEMENT-DISCOVERY-V39', 'Bài khám phá năng lực đa lĩnh vực · V39', 'DISCOVERY', [
        simpleSection('DISCOVERY-LOGIC', 'Tư duy logic và giải quyết vấn đề', [
            ['Một quy luật tăng lần lượt 2, 4, 6, 8. Số tiếp theo là gì?', ['9', '10', '11', '12'], '10'],
            ['Khi một kết quả không đúng dự đoán, bước nào hữu ích nhất?', ['Kiểm tra dữ liệu và từng giả định', 'Bỏ qua kết quả', 'Đổi mọi thông tin cùng lúc', 'Kết luận ngay'], 'Kiểm tra dữ liệu và từng giả định']
        ]),
        simpleSection('DISCOVERY-LANGUAGE', 'Đọc hiểu và ngôn ngữ', [
            ['Một thông báo ghi “hạn nộp được dời đến thứ Sáu”. Điều gì đúng?', ['Hạn mới là thứ Sáu', 'Hạn bị hủy', 'Phải nộp trước đó một tuần', 'Không còn cần nộp'], 'Hạn mới là thứ Sáu'],
            ['Khi đọc một hướng dẫn dài, cách nào giúp tránh bỏ sót yêu cầu?', ['Tóm tắt các bước và kiểm tra điều kiện', 'Chỉ đọc tiêu đề', 'Đoán phần còn lại', 'Bỏ qua ví dụ'], 'Tóm tắt các bước và kiểm tra điều kiện']
        ]),
        simpleSection('DISCOVERY-DIGITAL', 'Kỹ năng số và dữ liệu', [
            ['Trong bảng tính, công thức thường bắt đầu bằng ký hiệu nào?', ['=', '#', '@', '&'], '='],
            ['Bạn nhận được email yêu cầu nhập mật khẩu qua liên kết lạ. Nên làm gì?', ['Không nhập, xác minh qua kênh chính thức', 'Nhập ngay để tránh khóa tài khoản', 'Chuyển tiếp cho mọi người', 'Tải mọi tệp đính kèm'], 'Không nhập, xác minh qua kênh chính thức']
        ]),
        simpleSection('DISCOVERY-SCIENCE', 'Khoa học và suy luận thực tế', [
            ['Để so sánh hai cách học công bằng, điều gì nên được giữ tương đương?', ['Thời lượng và cách đo kết quả', 'Mọi người phải có cùng sở thích', 'Chỉ ghi kết quả tốt nhất', 'Thay nhiều yếu tố cùng lúc'], 'Thời lượng và cách đo kết quả'],
            ['Một biểu đồ cho thấy số liệu tăng trong ba tháng liên tiếp. Kết luận nào thận trọng nhất?', ['Số liệu tăng trong giai đoạn được quan sát', 'Nó chắc chắn sẽ tăng mãi', 'Một yếu tố duy nhất gây ra tăng trưởng', 'Không cần xem nguồn dữ liệu'], 'Số liệu tăng trong giai đoạn được quan sát']
        ])
    ]);
    return definitions;
}

async function up({ connection, logger = console } = {}) {
    const models = require('../../server/models/platform-models.js');
    if (!connection || connection.readyState !== 1) throw new Error('MongoDB must be connected before migration 011.');
    const survey = {
        title: 'Khảo sát mục tiêu học tập toàn diện · V21',
        description: 'Khảo sát điều kiện học tập, cấp học, mục tiêu, điểm mạnh/yếu, sở thích, định hướng nghề nghiệp và hồ sơ đại học để tạo lộ trình cá nhân hóa.',
        targetLevel: 'ALL', version: '21.0.0', questions: surveyQuestions(), status: 'PUBLISHED', sourceRef: SOURCE_REF
    };
    await models.Survey.findOneAndUpdate({ title: survey.title }, { $setOnInsert: survey }, { upsert: true, new: true, setDefaultsOnInsert: true });
    let placementCount = 0;
    for (const definition of placementDefinitions()) {
        await models.PlacementTest.findOneAndUpdate({ code: definition.code }, { $setOnInsert: definition }, { upsert: true, new: true, setDefaultsOnInsert: true });
        placementCount += 1;
    }
    logger.info?.(`✅ Migration 011: survey v21 + ${placementCount} placement catalogs ready.`);
    return { surveyQuestions: survey.questions.length, placementTests: placementCount };
}

module.exports = { id: '011-v21-survey-placement', up, surveyQuestions, placementDefinitions };
